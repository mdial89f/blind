import { Handler } from "aws-lambda";
import { decode } from "base-64";
import * as os from "./../../../libs/opensearch-lib";
import {
  SeaToolRecordsToDelete,
  SeaToolTransform,
  transformSeatoolData,
} from "shared-types/seatool";
import {
  OneMacRecordsToDelete,
  OneMacTransform,
  transformOnemac,
} from "shared-types/onemac";

if (!process.env.osDomain) {
  throw "ERROR:  process.env.osDomain is required,";
}
const osDomain: string = process.env.osDomain;

export const seatool: Handler = async (event) => {
  const seaToolRecords: (SeaToolTransform | SeaToolRecordsToDelete)[] = [];
  const docObject: Record<string, SeaToolTransform | SeaToolRecordsToDelete> =
    {};
  const rawArr: any[] = [];

  for (const recordKey of Object.keys(event.records)) {
    for (const seatoolRecord of event.records[recordKey] as {
      key: string;
      value: string;
    }[]) {
      const { key, value } = seatoolRecord;

      if (value) {
        const id: string = JSON.parse(decode(key));
        const record = { id, ...JSON.parse(decode(value)) };
        const validPlanTypeIds = [122, 123, 124, 125];
        const result = transformSeatoolData(id).safeParse(record);
        if (result.success === false) {
          console.log(
            "SEATOOL Validation Error. The following record failed to parse: ",
            JSON.stringify(record),
            "Because of the following Reason(s):",
            result.error.message
          );
        } else {
          if (validPlanTypeIds.includes(result.data.planTypeId)) {
            docObject[id] = result.data;
          }
          rawArr.push(record);
        }
      } else {
        // to handle deletes
        const id: string = JSON.parse(decode(key));
        const seaTombstone: SeaToolRecordsToDelete = {
          id,
          actionType: undefined,
          actionTypeId: undefined,
          approvedEffectiveDate: undefined,
          authority: undefined,
          changedDate: undefined,
          leadAnalystName: undefined,
          leadAnalystOfficerId: undefined,
          planType: undefined,
          planTypeId: undefined,
          proposedDate: undefined,
          raiReceivedDate: undefined,
          raiRequestedDate: undefined,
          state: undefined,
          cmsStatus: undefined,
          stateStatus: undefined,
          submissionDate: undefined,
        };

        docObject[id] = seaTombstone;

        console.log(
          `Record ${id} has been nullified with the following data: `,
          JSON.stringify(seaTombstone)
        );
      }
    }
  }
  for (const [, b] of Object.entries(docObject)) {
    seaToolRecords.push(b);
  }
  try {
    await os.bulkUpdateData(osDomain, "main", seaToolRecords);
    await os.bulkUpdateData(osDomain, "seatool", rawArr);
  } catch (error) {
    console.error(error);
  }
};

export const onemac: Handler = async (event) => {
  const oneMacRecords: (OneMacTransform | OneMacRecordsToDelete)[] = [];
  const docObject: Record<string, OneMacTransform | OneMacRecordsToDelete> = {};

  for (const recordKey of Object.keys(event.records)) {
    for (const onemacRecord of event.records[recordKey] as {
      key: string;
      value: string;
    }[]) {
      const { key, value } = onemacRecord;

      if (value) {
        const id: string = decode(key);
        const record = { id, ...JSON.parse(decode(value)) };
        if (
          record &&
          record.sk === "Package" &&
          record.submitterName &&
          record.submitterName !== "-- --" // these records did not originate from onemac, thus we ignore them
        ) {
          const result = transformOnemac(id).safeParse(record);
          if (result.success === false) {
            console.log(
              "ONEMAC Validation Error. The following record failed to parse: ",
              JSON.stringify(record),
              "Because of the following Reason(s):",
              result.error.message
            );
          } else {
            docObject[id] = result.data;
          }
        }
      } else {
        const id: string = decode(key);
        const oneMacTombstone: OneMacRecordsToDelete = {
          id,
          additionalInformation: undefined,
          attachments: undefined,
          submitterEmail: undefined,
          submitterName: undefined,
          origin: undefined,
          raiResponses: undefined,
        };

        docObject[id] = oneMacTombstone;

        console.log(
          `Record ${id} has been nullified with the following data: `,
          JSON.stringify(oneMacTombstone)
        );
      }
    }
  }
  for (const [, b] of Object.entries(docObject)) {
    oneMacRecords.push(b);
  }
  try {
    await os.bulkUpdateData(osDomain, "main", oneMacRecords);
  } catch (error) {
    console.error(error);
  }
};
