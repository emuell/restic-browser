// -------------------------------------------------------------------------------------------------

// Converts binary (file) data to text. When a BOM (Byte Order Mark) header is present, the
// header will be removed and used to auto-detect the encoding. When no BOM header is present,
// it will interpret the content as UTF8 string.
export function decodeTextData(uint8Array: Uint8Array): string {
  // UTF-32 LE BOM: FF FE 00 00
  if (
    uint8Array.length >= 4 &&
    uint8Array[0] === 0xff &&
    uint8Array[1] === 0xfe &&
    uint8Array[2] === 0x00 &&
    uint8Array[3] === 0x00
  ) {
    // Remove BOM and decode as UTF-32 LE
    const dataWithoutBOM = uint8Array.slice(4);
    return new TextDecoder("utf-32le").decode(dataWithoutBOM);
  }
  // UTF-32 BE BOM: 00 00 FE FF
  else if (
    uint8Array.length >= 4 &&
    uint8Array[0] === 0x00 &&
    uint8Array[1] === 0x00 &&
    uint8Array[2] === 0xfe &&
    uint8Array[3] === 0xff
  ) {
    // Remove BOM and decode as UTF-32 BE
    const dataWithoutBOM = uint8Array.slice(4);
    return new TextDecoder("utf-32be").decode(dataWithoutBOM);
  }
  // UTF-8 BOM: EF BB BF
  else if (
    uint8Array.length >= 3 &&
    uint8Array[0] === 0xef &&
    uint8Array[1] === 0xbb &&
    uint8Array[2] === 0xbf
  ) {
    // Remove BOM and decode as UTF-8
    const dataWithoutBOM = uint8Array.slice(3);
    return new TextDecoder("utf-8").decode(dataWithoutBOM);
  }
  // UTF-16 LE BOM: FF FE
  else if (uint8Array.length >= 2 && uint8Array[0] === 0xff && uint8Array[1] === 0xfe) {
    // Remove BOM and decode as UTF-16 LE
    const dataWithoutBOM = uint8Array.slice(2);
    return new TextDecoder("utf-16le").decode(dataWithoutBOM);
  }
  // UTF-16 BE BOM: FE FF
  else if (uint8Array.length >= 2 && uint8Array[0] === 0xfe && uint8Array[1] === 0xff) {
    // Remove BOM and decode as UTF-16 BE
    const dataWithoutBOM = uint8Array.slice(2);
    return new TextDecoder("utf-16be").decode(dataWithoutBOM);
  }
  // No BOM detected - default to UTF-8
  else {
    return new TextDecoder("utf-8").decode(uint8Array);
  }
}

// -------------------------------------------------------------------------------------------------

// Converts text data to raw utf8 binary data (without using BOM headers).
export function encodeTextData(text: string): Uint8Array {
  return new TextEncoder().encode(text);
}
