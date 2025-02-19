import { Argv } from "yargs";
import { LabeledProcessRunner, writeUiEnvFile } from "../lib/";
import path from "path";
import { execSync } from "child_process";
import {
  CloudFrontClient,
  CreateInvalidationCommand,
} from "@aws-sdk/client-cloudfront";
import { GetParameterCommand, SSMClient } from "@aws-sdk/client-ssm";

const runner = new LabeledProcessRunner();

export const deploy = {
  command: "deploy",
  describe: "deploy the project",
  builder: (yargs: Argv) => {
    return yargs.option("stage", { type: "string", demandOption: true });
  },
  handler: async (options: { stage: string; stack?: string }) => {
    await runner.run_command_and_output(
      "CDK Deploy",
      ["cdk", "deploy", "-c", `stage=${options.stage}`, "--all"],
      ".",
    );

    await writeUiEnvFile(options.stage);

    await runner.run_command_and_output(
      "Build",
      ["yarn", "build"],
      "react-app",
    );

    const { s3BucketName, cloudfrontDistributionId } = JSON.parse(
      (
        await new SSMClient({ region: "us-east-1" }).send(
          new GetParameterCommand({
            Name: `/${process.env.PROJECT}/${options.stage}/deployment-output`,
          }),
        )
      ).Parameter!.Value!,
    );

    if (!s3BucketName || !cloudfrontDistributionId) {
      throw new Error("Missing necessary CloudFormation exports");
    }

    const buildDir = path.join(__dirname, "../../../react-app", "dist");

    try {
      execSync(`find ${buildDir} -type f -exec touch -t 202001010000 {} +`);
    } catch (error) {
      console.error("Failed to set fixed timestamps:", error);
    }

    await runner.run_command_and_output(
      "S3 Sync",
      ["aws", "s3", "sync", buildDir, `s3://${s3BucketName}/`, "--delete"],
      ".",
    );

    const cloudfrontClient = new CloudFrontClient({
      region: process.env.REGION_A,
    });
    const invalidationParams = {
      DistributionId: cloudfrontDistributionId,
      InvalidationBatch: {
        CallerReference: `${Date.now()}`,
        Paths: {
          Quantity: 1,
          Items: ["/*"],
        },
      },
    };

    await cloudfrontClient.send(
      new CreateInvalidationCommand(invalidationParams),
    );

    console.log(
      `Deployed UI to S3 bucket ${s3BucketName} and invalidated CloudFront distribution ${cloudfrontDistributionId}`,
    );
  },
};
