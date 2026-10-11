import { Select as KobalteSelect } from "@kobalte/core/select";
import styles from "./style.module.css";
import { splitProps, type JSX } from "solid-js";

export type CommonSelectProps<T> = {
  options: T[];
  value?: T | null;
  onChange?: (value: T | null) => void;
  optionValue?: keyof T | ((option: T) => string);
  optionTextValue?: keyof T | ((option: T) => string);
  placeholder?: string;
  triggerClass?: string;
  optionLabelKey?: keyof T;
  icon?: JSX.Element;
  disabled?: boolean;
  name?: string;
  required?: boolean;
};

export function CommonSelect<T>(props: CommonSelectProps<T>) {
  const [local, rest] = splitProps(props, [
    "placeholder",
    "triggerClass",
    "optionLabelKey",
    "icon",
  ]);

  const labelKey = local.optionLabelKey ?? ("label" as keyof T);

  return (
    <KobalteSelect<T>
      {...(rest as any)}
      placeholder={local.placeholder}
      class={styles.root}
      itemComponent={(itemProps) => (
        <KobalteSelect.Item item={itemProps.item} class={styles.item}>
          <KobalteSelect.ItemLabel>
            {String((itemProps.item.rawValue as any)[labelKey])}
          </KobalteSelect.ItemLabel>
          <KobalteSelect.ItemIndicator class={styles.indicator}>
          </KobalteSelect.ItemIndicator>
        </KobalteSelect.Item>
      )}
    >
      <KobalteSelect.Trigger class={`${styles.trigger} ${local.triggerClass ?? ""}`}>
        <KobalteSelect.Value<T> class={styles.value}>
          {(state) => {
            const selected = state.selectedOption();
            if (!selected) return local.placeholder ?? "";
            return String((selected as any)[labelKey]);
          }}
        </KobalteSelect.Value>
        <KobalteSelect.Icon class={styles.icon}>
          {local.icon ?? "▼"}
        </KobalteSelect.Icon>
      </KobalteSelect.Trigger>

      <KobalteSelect.Portal>
        <KobalteSelect.Content class={styles.content}>
          <KobalteSelect.Listbox class={styles.listbox} />
        </KobalteSelect.Content>
      </KobalteSelect.Portal>
    </KobalteSelect>
  );
}
