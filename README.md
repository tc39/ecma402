ECMAScript Internationalization API Specification (Ecma-402)
====

## This repo

This repository contains the source for the current draft of ECMA-402, the ECMAScript® Internationalization API Specification.

This source is processed to obtain a human-readable version, which you can view [here](http://tc39.github.io/ecma402/).

## Current Proposals

Proposals follow [this process document](https://tc39.github.io/process-document/).

|🚀 | Proposal                              | Champion       | Stage | Notes
|---|---------------------------------------|--------------  | ------|------
|   | [Intl.DateTimeFormat.prototype.formatToParts][]                     | Zibi Braniecki |     4 |
|   | [Intl.NumberFormat.prototype.formatToParts][]                     | Zibi Braniecki |     3 |
|   | [Intl.PluralRules][]                  | Caridy Patiño, Eric Ferraiuolo |     3 |
|   | [Exposing Abstract Operations & Locale Info][]        | Zibi Braniecki  |     2 |
|   | [Intl.Segmenter: Unicode segmentation in JavaScript][]| Daniel Ehrenberg  |     2 |
|   | [Intl.ListFormat][]                   | Zibi Braniecki |     2 |
|   | [Intl.RelativeTimeFormat][]           | Caridy Patiño, Eric Ferraiuolo |     2 |
|   | [Intl.DurationFormat][]               | Zibi Braniecki |     1 |
|   | [Intl.UnitFormat][]                   | Zibi Braniecki |     1 |
|   | [DateTimeFormat dateStyle & timeStyle][]           | Zibi Braniecki |     1 |
|   | [Fix 9.2.3 LookupMatcher algorithm][] | Rafael Xavier  |     0 |
|   | [Intl.NumberFormat round option][]    | Rafael Xavier  |     0 |

[Intl.Segmenter: Unicode segmentation in JavaScript]: https://github.com/tc39/proposal-intl-segmenter
[Intl.ListFormat]: https://github.com/zbraniecki/intl-list-format-spec
[Fix 9.2.3 LookupMatcher algorithm]: https://github.com/rxaviers/ecma402-fix-lookup-matcher
[Intl.NumberFormat round option]: https://github.com/rxaviers/ecma402-number-format-round-option
[Intl.RelativeTimeFormat]: https://github.com/caridy/intl-relative-time-spec
[Intl.DurationFormat]: https://github.com/tc39/ecma402/issues/47
[Intl.UnitFormat]: https://github.com/tc39/ecma402/issues/32
[Intl.PluralRules]: https://github.com/caridy/intl-plural-rules-spec
[Intl.DateTimeFormat.prototype.formatToParts]: https://github.com/tc39/ecma402/issues/30
[Intl.NumberFormat.prototype.formatToParts]: https://github.com/tc39/ecma402/issues/30
[Exposing Abstract Operations & Locale Info]: https://github.com/tc39/ecma402/issues/46
[DateTimeFormat dateStyle & timeStyle]: https://github.com/zbraniecki/proposal-ecma402-datetime-style

🚀 means the champion thinks it's ready to advance but has not yet presented to the committee.


### Contributing New Proposals

Please see [Contributing to ECMAScript](/CONTRIBUTING.md) for the most up-to-date information on contributing proposals to this standard.


## Developing the Specification

After cloning, do `npm install` to set up your environment. You can then do `npm run build` to build the spec or `npm run watch` to set up a continuous build. The results will appear in the `out` directory, which you can use `npm run clean` to delete.
