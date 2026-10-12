/**
 * Conservatively estimates the UTF-8 byte length of PostgreSQL's jsonb text
 * output for JSON values produced by this application. PostgreSQL emits a
 * space after JSON separators and expands numeric exponents; both are counted.
 * This rejects values JSONB cannot represent safely rather than undercounting.
 */
export function profileJsonbByteLength(value) {
  const seen = new Set();

  function stringBytes(text) {
    let bytes = 2; // surrounding quotes
    for (let index = 0; index < text.length; index += 1) {
      const code = text.charCodeAt(index);
      if (code === 0) throw new TypeError('JSONB strings cannot contain NUL.');
      if (code >= 0xd800 && code <= 0xdbff) {
        const next = text.charCodeAt(index + 1);
        if (!(next >= 0xdc00 && next <= 0xdfff)) throw new TypeError('JSONB strings must contain valid Unicode.');
        bytes += 4;
        index += 1;
      } else if (code >= 0xdc00 && code <= 0xdfff) {
        throw new TypeError('JSONB strings must contain valid Unicode.');
      } else if (code === 0x22 || code === 0x5c || code === 0x08 || code === 0x09 || code === 0x0a || code === 0x0c || code === 0x0d) {
        bytes += 2;
      } else if (code < 0x20) {
        bytes += 6; // \u00xx
      } else if (code < 0x80) {
        bytes += 1;
      } else if (code < 0x800) {
        bytes += 2;
      } else {
        bytes += 3;
      }
    }
    return bytes;
  }

  function numberBytes(number) {
    if (!Number.isFinite(number)) throw new TypeError('JSONB numbers must be finite.');
    if (Object.is(number, -0)) return 1;
    const text = number.toString();
    const match = /^(-?)(\d+)(?:\.(\d+))?(?:e([+-]?\d+))?$/i.exec(text);
    if (!match) throw new TypeError('Unsupported JSONB number.');
    const [, sign, whole, fraction = '', exponentText] = match;
    if (exponentText === undefined) return text.length;
    const digits = whole + fraction;
    const decimalIndex = whole.length + Number(exponentText);
    let expandedLength;
    if (decimalIndex <= 0) expandedLength = 2 + -decimalIndex + digits.length;
    else if (decimalIndex >= digits.length) expandedLength = decimalIndex;
    else expandedLength = digits.length + 1;
    return sign.length + expandedLength;
  }

  function count(item) {
    if (item === null) return 4;
    if (typeof item === 'string') return stringBytes(item);
    if (typeof item === 'boolean') return item ? 4 : 5;
    if (typeof item === 'number') return numberBytes(item);
    if (typeof item !== 'object') throw new TypeError('Value is not JSON-compatible.');
    if (seen.has(item)) throw new TypeError('Cyclic values are not JSON-compatible.');
    seen.add(item);
    let bytes;
    if (Array.isArray(item)) {
      const ownKeys = Reflect.ownKeys(item).filter(key => key !== 'length');
      if (ownKeys.some(key => typeof key !== 'string' || !/^(0|[1-9]\d*)$/.test(key) || Number(key) >= item.length)) {
        throw new TypeError('Arrays must contain only indexed JSON values.');
      }
      const descriptors = Object.getOwnPropertyDescriptors(item);
      for (let index = 0; index < item.length; index += 1) {
        if (!descriptors[index] || !Object.hasOwn(descriptors[index], 'value')) {
          throw new TypeError('Sparse arrays and accessors are not JSON-compatible.');
        }
      }
      bytes = 2;
      for (let index = 0; index < item.length; index += 1) bytes += (index ? 2 : 0) + count(descriptors[index].value);
    } else {
      const prototype = Object.getPrototypeOf(item);
      if (prototype !== Object.prototype && prototype !== null) throw new TypeError('Objects must be plain JSON records.');
      const descriptors = Object.getOwnPropertyDescriptors(item);
      const keys = Object.keys(descriptors);
      bytes = 2;
      for (let index = 0; index < keys.length; index += 1) {
        const key = keys[index];
        if (!Object.hasOwn(descriptors[key], 'value')) throw new TypeError('Accessors are not JSON-compatible.');
        bytes += (index ? 2 : 0) + stringBytes(key) + 2 + count(descriptors[key].value);
      }
    }
    seen.delete(item);
    return bytes;
  }

  return count(value);
}
