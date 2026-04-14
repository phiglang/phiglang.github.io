# Phig Specification

v0.1.0

## Encoding

UTF-8. BOM optional, discouraged.

## Grammar

```
toplevel = [ BOM ] _ [ pairs ] _ EOF

value    = map | list | string

map      = '{' _ [ pairs ] _ '}'
pairs    = pair { PAIRSEP _ pair }
pair     = string [ HSPACE ] value [ HSPACE ] [ COMMENT ]

list     = '[' _ [ items ] _ ']'
items    = value { _ [ ';' ] _ value }

string   = QSTRING | QRSTRING | BARE
QSTRING  = '"' { QCHAR } '"'
QCHAR    = /[^"\\]/ | QESCAPE
QESCAPE  = '\' ( /[rnt\\"0]/ | /\r?\n/ | 'u{' /[0-9a-fA-F]{1,6}/ '}' )
QRSTRING = "'" /[^']*/ "'"
BARE     = /[^\p{White_Space}{}[\]"#';]+/

_        = { WS | COMMENT }
BOM      = /\u{FEFF}/
WS       = /[\r\n\t ]+/
COMMENT  = '#' /[^\n]*/
HSPACE   = /[ \t]+/
PAIRSEP  = /(\r?\n)+|;/
```

## Data model

Three types: **string**, **list** (ordered values), **map** (ordered key-value pairs). No numbers, booleans, or null. Type coercion is left to the consumer.

## Whitespace

Only four characters are structural whitespace: space (U+0020), tab (U+0009), newline (U+000A), carriage return (U+000D). Other Unicode whitespace characters (e.g., NBSP) are not valid anywhere in a document outside of quoted or raw strings.

## Strings

**Bare**: Contiguous non-whitespace (Unicode `White_Space`), non-special characters. Cannot be empty.

**Quoted** (`"..."`): Supports escapes:

| Escape | Result |
|-|-|
| `\n` `\r` `\t` `\\` `\"` `\0` | the usual |
| `\` CRLF or LF | line continuation (no output) |
| `\u{X}` | Unicode scalar (1–6 hex digits) |

Any other `\X` is an error. Surrogates and code points above U+10FFFF are errors.

**Raw** (`'...'`): Literal content, no escapes. Cannot contain `'`.

## Maps

Braces delimit maps. Keys are strings, values are any type. Pairs are separated by newlines or semicolons. A trailing separator after the last pair is permitted, but consecutive separators without a pair between them (e.g., `;;`) are not. Duplicate keys in the same map are an error. Implementations should preserve key order if possible. Mismatched closing delimiters (e.g., `{` closed by `]`) are errors.

## Lists

Brackets delimit lists. Items are separated by whitespace; semicolons are optional additional separators.

## Top level

A document is an implicit map. A top-level list or bare value is an error.

## Errors

A conforming parser MUST reject: unterminated or invalid strings, unclosed or mismatched delimiters, extra closing delimiters, duplicate keys, missing values, missing pair separators, invalid escapes, and non-map top-level values.

Error message format is not specified.

## Serialization

Not normative. Any valid phig that round-trips to the same data is acceptable.
