const SIMPLE_QESCAPES = {
  r: "\r",
  t: "\t",
  n: "\n",
  "\n": "",
  "\\": "\\",
  '"': '"',
  0: "\0",
};

export type TokenClass =
  | "comment"
  | "key"
  | "string"
  | "punct"
  | "qescape"
  | "error";

export interface Error {
  start: number;
  end: number;
  msg: string;
}

export function parse(
  src: string,
  emit: (cls: TokenClass | null, text: string) => void = () => {},
) {
  let pos = 0;
  const len = src.length;
  const errors: Error[] = [];

  function err(msg: string, start: number, end: number) {
    errors.push({ msg, start, end });
  }

  // HSPACE = /[ \t]+/
  function hspace(): boolean {
    if (pos < len && (src[pos] === " " || src[pos] === "\t")) {
      const start = pos;
      while (pos < len && (src[pos] === " " || src[pos] === "\t")) ++pos;
      emit(null, src.slice(start, pos));
      return true;
    }
    return false;
  }

  // PAIRSEP = /(\r?\n)+|;/
  function pairsep(): boolean {
    if (pos < len && src[pos] === ";") {
      emit("punct", src.slice(pos, pos + 1));
      ++pos;
      return true;
    }
    const start = pos;
    while (pos < len) {
      if (src[pos] === "\n") {
        ++pos;
      } else if (src[pos] === "\r" && pos + 1 < len && src[pos + 1] === "\n") {
        pos += 2;
      } else {
        break;
      }
    }
    if (pos > start) {
      emit(null, src.slice(start, pos));
      return true;
    }
    return false;
  }

  // COMMENT = '#' /[^\n]*/
  function comment(): boolean {
    if (pos < len && src[pos] === "#") {
      const start = pos;
      while (pos < len && src[pos] !== "\n") ++pos;
      emit("comment", src.slice(start, pos));
      return true;
    }
    return false;
  }

  // _ = { /\s+/ | COMMENT }
  function wsc() {
    while (pos < len) {
      if (src[pos] === "#") {
        comment();
      } else if (/\s/.test(src[pos])) {
        const start = pos;
        while (pos < len && /\s/.test(src[pos]) && src[pos] !== "#") ++pos;
        emit(null, src.slice(start, pos));
      } else {
        break;
      }
    }
  }

  // QESCAPE unicode escape helper
  function unicodeEscape(escStart: number) {
    ++pos; // skip 'u'
    if (pos >= len || src[pos] !== "{") {
      emit("error", src.slice(escStart, pos));
      err("expected '{' after \\u", escStart, pos);
      return null;
    }
    ++pos; // skip '{'

    let hex = "";
    while (pos < len && src[pos] !== "}") {
      if (!/[0-9a-fA-F]/.test(src[pos])) break;
      hex += src[pos++];
    }

    if (!hex || hex.length > 6 || pos >= len || src[pos] !== "}") {
      while (pos < len && !/[}"\n]/.test(src[pos])) ++pos;
      if (pos < len && src[pos] === "}") ++pos;
      emit("error", src.slice(escStart, pos));
      err("invalid unicode escape", escStart, pos);
      return null;
    }
    ++pos; // skip '}'

    const cp = parseInt(hex, 16);
    if (cp > 0x10ffff) {
      emit("error", src.slice(escStart, pos));
      err("unicode codepoint out of range", escStart, pos);
      return null;
    }

    emit("qescape", src.slice(escStart, pos));
    return String.fromCodePoint(cp);
  }

  // QSTRING  = '"' { QCHAR } '"'
  // QCHAR    = /[^"\\]/ | QESCAPE
  // QESCAPE  = '\' ( /[nrt\\"0\n]/ | 'u{' /[0-9a-fA-F]{1,6}/ '}' )
  function qstring(cls: TokenClass) {
    const openPos = pos;
    emit(cls, '"');
    ++pos; // skip opening quote

    let result = "";
    while (pos < len && src[pos] !== '"') {
      if (src[pos] !== "\\") {
        // plain text run: { /[^"\\]/ }
        const start = pos;
        while (pos < len && src[pos] !== '"' && src[pos] !== "\\") ++pos;
        const chunk = src.slice(start, pos);
        result += chunk;
        emit(cls, chunk);
        continue;
      }

      // escape sequence
      const escStart = pos;
      ++pos; // skip backslash
      if (pos >= len) {
        emit("error", src.slice(escStart, pos));
        err("unterminated escape", escStart, pos);
        break;
      }

      const c = src[pos];
      if (c in SIMPLE_QESCAPES) {
        result += SIMPLE_QESCAPES[c as keyof typeof SIMPLE_QESCAPES];
        ++pos;
        emit("qescape", src.slice(escStart, pos));
      } else if (c === "u") {
        const decoded = unicodeEscape(escStart);
        if (decoded !== null) result += decoded;
      } else {
        ++pos;
        emit("error", src.slice(escStart, pos));
        err(`invalid escape '\\${c}'`, escStart, pos);
      }
    }

    if (pos < len && src[pos] === '"') {
      emit(cls, '"');
      ++pos;
    } else {
      err("unterminated string", openPos, pos);
    }
    return result;
  }

  // BARE = /[^\s{}\[\]"#';]+/
  function bare(): string | null {
    const start = pos;
    while (pos < len && !/[\s{}\[\]"#';]/.test(src[pos])) ++pos;
    if (pos === start) return null;
    return src.slice(start, pos);
  }

  // QRSTRING = "'" /[^']*/ "'"
  function qrstring(cls: TokenClass): string {
    const openPos = pos;
    emit(cls, "'");
    ++pos;
    const start = pos;
    while (pos < len && src[pos] !== "'") ++pos;
    const content = src.slice(start, pos);
    if (content) emit(cls, content);
    if (pos < len && src[pos] === "'") {
      emit(cls, "'");
      ++pos;
    } else {
      err("unterminated raw string", openPos, pos);
    }
    return content;
  }

  // string = QSTRING | QRSTRING | BARE
  function string(cls: TokenClass): string | null {
    if (pos < len && src[pos] === '"') return qstring(cls);
    if (pos < len && src[pos] === "'") return qrstring(cls);
    const v = bare();
    if (v !== null) {
      emit(cls, v);
      return v;
    }
    return null;
  }

  // value = map | list | string
  function value(): unknown {
    if (pos >= len) return null;
    if (src[pos] === "{") return map();
    if (src[pos] === "[") return list();
    return string("string");
  }

  // pair = string [ HSPACE ] value [ HSPACE ] [ COMMENT ]
  function pair(
    obj: Record<string, unknown>,
  ): { key: string; value: unknown } | null {
    const start = pos;
    const k = string("key");
    if (k === null) return null;
    if (k in obj) err(`duplicate key '${k}'`, start, pos);

    hspace();
    const v = value();
    if (v === null) err(`expected value for key '${k}'`, start, pos);
    hspace();
    comment();
    return { key: k, value: v };
  }

  // pairs = pair { PAIRSEP _ pair }
  function pairs(closingChar: string | null): Record<string, unknown> {
    const obj: Record<string, unknown> = {};

    while (pos < len && src[pos] !== closingChar) {
      const p = pair(obj);
      if (p === null) {
        if (pos < len && src[pos] !== closingChar) {
          err(`unexpected '${src[pos]}'`, pos, pos + 1);
          emit("error", src[pos]);
          ++pos;
        }
        wsc();
        continue;
      }

      if (p.value !== null) {
        obj[p.key] = p.value;
      }

      if (pos >= len || src[pos] === closingChar) break;

      if (!pairsep()) {
        err("expected newline or ';' after value", pos, pos + 1);
        continue;
      }
      wsc();
    }
    return obj;
  }

  // map = '{' _ [ pairs ] _ '}'
  function map(): Record<string, unknown> {
    const openPos = pos;
    emit("punct", "{");
    ++pos;
    wsc();
    const obj = pairs("}");
    wsc();
    if (pos < len && src[pos] === "}") {
      emit("punct", "}");
      ++pos;
    } else {
      err("unclosed '{'", openPos, openPos + 1);
    }
    return obj;
  }

  // list = '[' _ { value _ } ']'
  function list(): unknown[] {
    const openPos = pos;
    emit("punct", "[");
    ++pos;
    const arr: unknown[] = [];
    wsc();
    while (pos < len && src[pos] !== "]") {
      const v = value();
      if (v === null) {
        if (pos < len && src[pos] !== "]") {
          err(`unexpected '${src[pos]}'`, pos, pos + 1);
          emit("error", src[pos]);
          ++pos;
        }
        wsc();
        continue;
      }
      arr.push(v);
      wsc();
    }
    if (pos < len && src[pos] === "]") {
      emit("punct", "]");
      ++pos;
    } else {
      err("unclosed '['", openPos, openPos + 1);
    }
    return arr;
  }

  // toplevel = _ [ pairs ] _
  wsc();
  const root = pairs(null);
  wsc();

  return { root, errors };
}
