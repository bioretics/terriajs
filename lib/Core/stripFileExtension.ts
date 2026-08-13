import { getLocalDataTypeExtensions } from "./getDataType";

export default function stripFileExtension(name: string): string {
  const dotIndex = name.lastIndexOf(".");
  if (dotIndex <= 0) {
    return name;
  }

  const extension = name.slice(dotIndex + 1).toLowerCase();
  return getLocalDataTypeExtensions().includes(extension)
    ? name.slice(0, dotIndex)
    : name;
}
