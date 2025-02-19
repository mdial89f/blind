/* eslint-disable react/prop-types */
import { useGetUser } from "@/api/useGetUser";
import { OPTIONS_STATE } from "./consts";
import * as I from "@/components/Inputs";
import {
  ControllerProps,
  FieldPath,
  FieldValues,
  useFieldArray,
  useFormContext,
} from "react-hook-form";
import { ReactNode, useEffect, useState } from "react";
import { useDebounce } from "@/hooks";
import { Plus, XIcon } from "lucide-react";
import { motion } from "framer-motion";
import { Loader } from "lucide-react";
import { cn } from "@/utils";
import { zAppkWaiverNumberSchema } from "@/utils";
import { itemExists } from "@/api";

export const SlotStateSelect = <
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>,
>({
  label,
  ...props
}: {
  label: ReactNode;
  className?: string;
}): ControllerProps<TFieldValues, TName>["render"] =>
  function Render({ field }) {
    const { data: user } = useGetUser();
    const stateAccess = user?.user?.["custom:state"]?.split(",");
    return (
      <I.FormItem {...props} className="w-[280px]">
        <I.FormLabel className="font-bold">{label}</I.FormLabel>
        <I.Select onValueChange={field.onChange} value={field.value}>
          <I.SelectTrigger>
            <I.SelectValue placeholder="Select State" />
          </I.SelectTrigger>
          <I.SelectContent className="overflow-auto max-h-60">
            {stateAccess?.map((STATE) => (
              <I.SelectItem key={`OPT-${STATE}`} value={STATE}>
                {OPTIONS_STATE.find((OPT) => OPT.value === STATE)?.label}
              </I.SelectItem>
            ))}
          </I.SelectContent>
        </I.Select>
        <I.FormMessage />
      </I.FormItem>
    );
  };

export const SlotWaiverId = <
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>,
>({
  state,
  onRemove,
  ...props
}: {
  state: string;
  onRemove?: () => void;
  className?: string;
}): ControllerProps<TFieldValues, TName>["render"] =>
  function Render({ field, fieldState }) {
    const debounced = useDebounce(field.value, 750);
    const [loading, setLoading] = useState<boolean>(false);
    const context = useFormContext();

    const onValidate = async (value: string) => {
      const preExitConditions = !state || !value;
      // if (preExitConditions) return context.clearErrors(field.name);
      if (preExitConditions) return;

      setLoading(true);

      const [_, index] = field.name.split(".");
      const childWaivers = context.getValues("waiverIds") || [];
      const existsInList = childWaivers
        .filter((_: any, I: number) => I != Number(index))
        .includes(value);

      if (existsInList) {
        return context.setError(field.name, {
          message: "Waiver ID is already included in this Appendix-K",
        });
      }

      const parsed = await zAppkWaiverNumberSchema.safeParseAsync(value);

      if (!parsed.success) {
        const [err] = parsed.error.errors;
        return context.setError(field.name, err);
      }

      const exists = await itemExists(`${state}-${value}`);

      if (exists) {
        return context.setError(field.name, {
          message:
            "According to our records, this Waiver Amendment Number already exists. Please check the Waiver Amendment Number and try entering it again.",
        });
      }

      context.clearErrors(field.name);
    };

    useEffect(() => {
      onValidate(debounced).then(() => setLoading(false));
    }, [debounced]);

    return (
      <I.FormItem {...props}>
        <div className="relative flex gap-1 items-center">
          <div className="relative flex gap-2 items-center">
            <p className="text-sm font-semibold">{state} -</p>
            <I.Input
              className={cn({
                "w-[250px]": true,
                "border-red-500": !!fieldState.error?.message,
                "border-green-500": !!debounced && !fieldState.error?.message,
              })}
              placeholder="#####.R##.##"
              autoFocus
              onChange={(e) => {
                field.onChange({
                  target: { value: e.target.value.toUpperCase() },
                });
              }}
              value={field.value}
            />
            {loading && (
              <motion.div
                className="absolute right-[10px] inset-y-0 w-6 h-6 my-auto origin-center flex items-center justify-center"
                animate={{ rotate: "360deg" }}
                transition={{ repeat: Infinity, duration: 0.5 }}
              >
                <Loader className="w-4 h-4 text-slate-950" />
              </motion.div>
            )}
          </div>
          {onRemove && (
            <XIcon size={20} onClick={onRemove} className={"cursor-pointer"} />
          )}
          {!onRemove && (
            <div className="ml-1">
              <I.RequiredIndicator />
            </div>
          )}
        </div>
        <I.FormMessage />
      </I.FormItem>
    );
  };

export const WaiverIdFieldArray = (props: any) => {
  const fieldArr = useFieldArray({
    control: props.control,
    name: props.name,
    shouldUnregister: true,
  });

  return (
    <div>
      <div className="flex flex-col gap-2 justify-start">
        <I.FormLabel className="w-[500px]">
          <strong>
            The first ID entered will be used to track the submission on the
            OneMAC dashboard.
          </strong>{" "}
          You will be able to find other waiver IDs entered below by searching
          for the first waiver ID.
        </I.FormLabel>{" "}
        <I.FormLabel></I.FormLabel>
        <div className="flex flex-col py-2 gap-4">
          {fieldArr.fields.map((FLD, index) => {
            return (
              <div key={FLD.id} style={{ width: "max-content" }}>
                <I.FormField
                  control={props.control}
                  name={`${props.name}.${index}`}
                  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
                  // @ts-ignore
                  render={SlotWaiverId({
                    ...(index && { onRemove: () => fieldArr.remove(index) }),
                    state: props.state,
                  })}
                />
              </div>
            );
          })}
          <I.Button
            disabled={!props.state}
            type="button"
            size="sm"
            onClick={() => fieldArr.append("")}
            variant="outline"
            className="w-[13%] mt-2"
          >
            <Plus className="h-5 w-5 mr-1" />
            Add ID
          </I.Button>
        </div>
      </div>
    </div>
  );
};
