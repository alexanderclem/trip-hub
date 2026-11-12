import { TextInput, type TextInputProps } from '@astryxdesign/core/TextInput'

/** Controlled text fields use Astryx's Field, label, description and input together. */
export function TextField(props: TextInputProps & { maxLength?: number }) {
  return <TextInput {...props} {...{ required: props.isRequired, disabled: props.isDisabled }} aria-label={props['aria-label'] ?? props.label} containerClassName="stowaway-text-field" controlClassName="stowaway-text-control" width="100%" size="lg" />
}
