# Phig Specification

v0.1.0

The key words "MUST", "MUST NOT", "REQUIRED", "SHALL", "SHALL NOT", "SHOULD", "SHOULD NOT", "RECOMMENDED", "NOT RECOMMENDED", "MAY", and "OPTIONAL" in this document are to be interpreted as described in BCP 14 [RFC 2119] [RFC 8174] when, and only when, they appear in all capitals, as shown here.

## Introduction

Phig is a minimal configuration language with three data types: strings, lists, and maps. It is designed to be simple to parse and simple to read. This document defines the syntax and data model of phig.

## Encoding

A phig document MUST be encoded as UTF-8. A byte order mark (BOM) MAY be present at the start of a document but is NOT RECOMMENDED.

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

## Data Model

The phig data model defines three types: **string**, **list** (an ordered sequence of values), and **map** (an ordered sequence of key-value pairs). There are no numeric, boolean, or null types. Type coercion is left to the consuming application.

## Whitespace

Only four characters SHALL be recognized as structural whitespace: space (U+0020), tab (U+0009), newline (U+000A), and carriage return (U+000D). All other Unicode whitespace characters (e.g., NBSP) MUST NOT appear anywhere in a document outside of quoted or raw strings.

## Strings

**Bare**: A bare string is a contiguous sequence of characters that are neither Unicode `White_Space` nor special (`{}[]"#';`). A bare string MUST contain at least one character.

**Quoted** (`"..."`): A quoted string supports the following escape sequences:

| Escape | Result |
|-|-|
| `\n` | U+000A LINE FEED |
| `\r` | U+000D CARRIAGE RETURN |
| `\t` | U+0009 CHARACTER TABULATION |
| `\\` | U+005C REVERSE SOLIDUS |
| `\"` | U+0022 QUOTATION MARK |
| `\0` | U+0000 NULL |
| `\` followed by CRLF or LF | line continuation (nothing is emitted) |
| `\u{X}` | Unicode scalar value (1–6 hex digits) |

Any escape sequence not listed above is an error. A `\u{X}` escape that refers to a surrogate code point or a value above U+10FFFF is an error.

**Raw** (`'...'`): A raw string contains literal content with no escape processing. A raw string MUST NOT contain the single-quote character (`'`).

## Maps

Braces (`{` `}`) delimit maps. Keys MUST be strings; values MAY be of any type. Pairs MUST be separated by one or more newlines or by a semicolon. A trailing separator after the last pair is OPTIONAL. Consecutive separators without an intervening pair (e.g., `{a x ;; b y}`) are an error. A map MUST NOT contain duplicate keys. Implementations SHOULD preserve key insertion order. A closing delimiter MUST match its corresponding opening delimiter; `{` closed by `]` (or vice versa) is an error.

## Lists

Brackets (`[` `]`) delimit lists. Items MUST be separated by whitespace. A single semicolon MAY be used as a separator between items. Consecutive semicolons without an intervening item (e.g., `[a ;; b]`) are an error. A closing delimiter MUST match its corresponding opening delimiter; `[` closed by `}` (or vice versa) is an error.

## Top Level

A phig document is an implicit map. A document whose top-level value is a list or a bare string is an error.

## Errors

A conforming parser MUST reject any document that contains one or more of the following: an unterminated or invalid string, an unclosed or mismatched delimiter, an extra closing delimiter, duplicate keys within a single map, a missing value in a pair, a missing pair separator, an invalid escape sequence, or a non-map top-level value.

The format of error messages is not specified by this document.

## Serialization

This section is non-normative. Any valid phig document that round-trips to the same data model is acceptable output for a serializer.
