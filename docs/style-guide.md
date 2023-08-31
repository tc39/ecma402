# ECMA-402 Style Guide

This document is an evolving list of recommendations for the ECMA-402 specification.  Other specifications may refer to this document if desired.  Also see the [W3C TAG Design Principles](https://w3ctag.github.io/design-principles/#casing-rules) for additional guidance.

This document contains background on how the style decisions were reached.  The actual recommendations are highlighted with a :star2: emoji.


## Table of Contents

- [Casing Conventions](#casing-conventions)
    - [Identifiers defined by ECMA-402](#identifiers-defined-by-ecma-402)
        - [Examples](#examples)
        - [Alternative: Kebab case for all string enumerations](#alternative-kebab-case-for-all-string-enumerations)
            - [Pros](#pros)
            - [Cons](#cons)
            - [Decision](#decision)
        - [Alternative: Kebab case for new identifiers only](#alternative-kebab-case-for-new-identifiers-only)
            - [Pros](#pros-1)
            - [Cons](#cons-1)
            - [Decision](#decision-1)
        - [Alternative: Use kebab case but also accept camel case](#alternative-use-kebab-case-but-also-accept-camel-case)
            - [Pros](#pros-2)
            - [Cons](#cons-2)
            - [Decision](#decision-2)
    - [Identifiers defined outside ECMA-402](#identifiers-defined-outside-ecma-402)
        - [Examples](#examples-1)
        - [Alternative: Convert identifiers to camel case](#alternative-convert-identifiers-to-camel-case)
            - [Pros](#pros-3)
            - [Cons](#cons-3)
            - [Decision](#decision-3)
    - [Element Ordering](#element-ordering)
	    - [General Guidelines](#general-guidelines)
	    - [resolvedOptions](#resolvedoptions)

*Table of Contents generated using https://magnetikonline.github.io/markdown-toc-generate/*

## Casing Conventions

This section concerns the casing conventions for identifiers and string literals in ECMA-402.

There are several accepted conventions for the casing of identifiers in programming.  This document uses the following definitions:

- **Pascal case:** First letter of each tokens in the identifer is uppercase, and all other letters are lowercase. Example: `HelloWorld`
- **Camel case:** Like Pascal case, except that the first letter of the identifier is lowercase. Example: `helloWorld`
- **Kebab case:** All letters are lowercase, and an ASCII hyphen `-` separates tokens. Example: `hello-world`

### Identifiers defined by ECMA-402

:star2: *Use Pascal case for class names and global namespaces; use camel case for all other identifiers.* :star2:

#### Examples

The function names, object keys, and string enumeration values below are all in camel case.

```javascript
new Intl.DisplayNames(undefined, {
    type: "dateTimeField"
}).of("timeZoneName");

number.toLocaleString(undefined, {
    signDisplay: "exceptZero"
});
```

#### Alternative: Kebab case for all string enumerations

We could more closely follow the W3C TAG recommendation, which uses kebab case for string enumeration values.  This would result in something such as:

```javascript
new Intl.DisplayNames(undefined, {
    type: "date-time-field"
}).of("time-zone-name");

number.toLocaleString(undefined, {
    signDisplay: "except-zero"
});
```

##### Pros

- More consistent with web conventions outside of ECMA-402; follows programmer intuition.
- More consistent with the local identifier syntax discussed below.
- ECMA-262 has limited precedent, but there are examples of kebab case, such as [the return value of *Atomics.wait*](https://www.ecma-international.org/ecma-262/10.0/index.html#sec-atomics.wait), a string enumeration that is `"ok"`, `"not-equal"`, or `"timed-out"`.

##### Cons

- Some string enumerations can be use not only as a string but also as a key in an object literal.  It is desirable to use the same identifier in both places.  For example, the identifier `"timeZoneName"` below:

```javascript
new Intl.DateTimeFormat("en-US", {
  timeZoneName: "short"
}).formatToParts(0);

/*
0: {type: "month", value: "12"}
1: {type: "literal", value: "/"}
2: {type: "day", value: "31"}
3: {type: "literal", value: "/"}
4: {type: "year", value: "1969"}
5: {type: "literal", value: ", "}
6: {type: "timeZoneName", value: "PST"}
*/
```

- String identifiers can appear in both the input and the output of an API, so we can't restrict camel case only to API output.  For example, `"timeZoneName"` also appears in this context:

```javascript
new Intl.DisplayNames(undefined, {
    type: "dateTimeField"
}).of("timeZoneName");
```

##### Decision

- The ergonomics of using the same identifier in multiple contexts outweights the desire to match the W3C convention.
- We believe that most users will typically copy these strings off MDN, rather than typing them manually, weakening the importance of following programmer intuition.

#### Alternative: Kebab case for new identifiers only

A way to be closer to the W3C recommendation would be to use kebab case except when there's precedent for camel case in the identifier.  So, for `"timeZoneName"`, we would use camel case, but for a new identifier like `"except-zero"`, we would use kebab case.  Example:

```javascript
new Intl.DisplayNames(undefined, {
    type: "date-time-field"
}).of("timeZoneName");

number.toLocaleString(undefined, {
    signDisplay: "except-zero"
});
```

##### Pros

- Identifiers that are used in multiple contexts are consistent in the API across input, output, and keys.
- Most identifiers follow programmer intuition; those that don't are the exception rather than the rule.

##### Cons

- Could introduce problems if a string is introduced as kebab case now and then in the future wants to be used as the key of an object literal.
- Can introduce inconsistencies even in the same line of code, as shown in the example above.

##### Decision

- This hybrid approach creates more problems while not fully addressing the concerns of the kebab-case-only approach.

#### Alternative: Use kebab case but also accept camel case

ECMA-402 could allow users to choose between kebab case and camel case for relevant identifiers.  For example, when calling `Intl.DisplayNames.prototype.of`, the identifier could be either `"timeZoneName"` or `"time-zone-name"` and both would be treated equally.

##### Pros

- When writing code, programmers can follow their intuition.
- We still allow programmers to use the same identifiers in multiple contexts.

##### Cons

- Output strings (those generated by library functions rather than written in user code) cannot have multiple cases; this alternative does not clarify how to handle such strings.
- Could sow confusion as a result of multiple ways to achieve the same result.

##### Decision

- It is difficult to take this option seriously since it would add debt to the specification.
- If strongly desired, the spec could be changed later to allow the kebab-cased strings.

### Identifiers defined outside ECMA-402

:star2: *ECMA-402 sits between ECMA-262 and internationalization standards such as UTS #35. For identifiers whose syntax comes from a different specification, follow the convention in that specification.* :star2:

#### Examples

[BCP47](http://www.rfc-editor.org/rfc/bcp/bcp47.txt) identifiers, using registered extensions as described in [UTS#35§3](https://www.unicode.org/reports/tr35/#Identifiers).  Examples:

- `"en-US"`
- `"ar-EG-u-nu-latn"`

Unit identifiers, defined in [UTS #35 Part 2 Section 6](https://www.unicode.org/reports/tr35/tr35-general.html#Unit_Elements).  Examples:

- `"square-kilometer"`
- `"part-per-million"`

#### Alternative: Convert identifiers to camel case

We could enforce a camel case convention on these strings, such as the following:

- `"enUs"`
- `"arEgUNuLatn"`
- `"squareKilometer"`
- `"partPerMillion"`

##### Pros

- More consistent with the recommendation for identifiers defined in ECMA-402.
- The identifiers could be used as keys in an object literal.
- Users typing these strings don't care that the syntax came from someone else's spec.

##### Cons

- If the strings come from an external source, they might have to be converted to camel case before use.
- Loss of the ability to use different cases within the identifier, like `"US"` in `"en-US"`.
- More difficult to read in cases where there are many short tokens, such as in locale identifiers.

##### Decision

- Defer the decision on the syntax for identifiers to the other specification when possible.

## Element Ordering

This section concerns the observable order for elements of arrays and properties of objects.

### General Guidelines

:star2: *ECMA-402 must provide a deterministic order for the elements of all arrays and the properties of all objects. This order should be lexicographic except in cases for which there is a clearly preferable semantic ordering. :star2:*

For example, an array holding the time zone identifiers "Asia/Tokyo", "Asia/Ho_Chi_Minh", and "Asia/Dubai" should use the order `["Asia/Dubai", "Asia/Ho_Chi_Minh", "Asia/Tokyo"]`

For an example of when *not* to use lexicographic order, consider an array holding calendar time scale units. This array could be ordered by descending magnitude as `["years", "months", "weeks", "days"]` or its reverse ascending magnitude as `["days", "weeks", "months", "years"]`, but should not use the lexicographic `["days", "months", "weeks", "years"]` order.

### `resolvedOptions`
:star2: *Properties in the output from `resolvedOptions()` of an Intl object should start with `locale` and otherwise use lexicographic order. Deviations (such as those motivated by semantic order involving a subset of properties) must be documented.* :star2:

Spec changes that add properties should do so in accordance with this recommendation, rather than automatically placing them at the end—relative enumeration order of properties should remain stable over time, but there is no such expectation regarding adjacency.
#### Examples
`Object.keys(new Intl.Segmenter().resolvedOptions())` returns `[ 'locale', 'granularity' ]`. If support for the [Unicode BCP 47 U Extension "dx" key](https://unicode.org/reports/tr35/#UnicodeDictionaryBreakExclusionIdentifier) were added and exposed as `dictionaryBreakExcludedScripts`, that property would belong before `granularity`.
