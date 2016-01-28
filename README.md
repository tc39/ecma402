ECMAScript Internationalization API Specification (Ecma-402)
====

[Current Draft](http://tc39.github.io/ecma402/)

## Current Proposals
ES Intl Proposals follow [this process document](https://docs.google.com/document/d/1QbEE0BsO4lvl7NFTn5WXWeiEIBfaVUF7Dk0hpPpPDzU).

|🚀| Proposal                                | Champion      | Stage | Notes
|---|---------------------------------------|--------------  | ------|------
|   | [Intl.PluralRules][]                  | Caridy Patiño, Eric Ferraiuolo |     2 |
|   | [Exposing Abstract Operations & Locale Info][]        | Zibi Braniecki  |     2 |
|   | [formatToParts][]                     | Zibi Braniecki |     2 |
|   | [Fix 9.2.3 LookupMatcher algorithm][] | Rafael Xavier  |     0 |    
|   | [Intl.NumberFormat round option][]    | Rafael Xavier  |     0 |
|   | [Intl.ListFormat][]                   | Zibi Braniecki |     0 |
|   | [Intl.DurationFormat][]               | Zibi Braniecki |     0 |
|   | [Intl.UnitFormat][]                   | Zibi Braniecki |     0 |
|   | [Intl.RelativeTimeFormat][]           | Caridy Patiño, Eric Ferraiuolo |     0 |


[Intl.ListFormat]: https://github.com/zbraniecki/intl-list-format-spec
[Fix 9.2.3 LookupMatcher algorithm]: https://github.com/rxaviers/ecma402-fix-lookup-matcher
[Intl.NumberFormat round option]: https://github.com/rxaviers/ecma402-number-format-round-option
[Intl.RelativeTimeFormat]: https://github.com/caridy/intl-relative-time-spec
[Intl.DurationFormat]: https://github.com/tc39/ecma402/issues/47
[Intl.UnitFormat]: https://github.com/tc39/ecma402/issues/32
[Intl.PluralRules]: https://github.com/caridy/intl-plural-rules-spec
[formatToParts]: https://github.com/tc39/ecma402/issues/30
[Exposing Abstract Operations & Locale Info]: https://github.com/tc39/ecma402/issues/46

🚀 means the champion thinks it's ready to advance but has not yet presented to the committee.


### Contributing New Proposals
If you are a TC39 member representative, just submit a pull request for your proposal.

Ecma TC39 accepts Strawman Proposals from non-member individuals who have accepted the TC39 copyright and patent policies. Currently all ECMAScript Internationalization related technical work is done by the TC39 RF TG (Royalty Free Task Group), for which the following IPR Policies apply:

  * [TC39 RF Patent Policy](http://www.ecma-international.org/memento/TC39%20policy/Ecma%20Experimental%20TC39%20Royalty-Free%20Patent%20Policy.pdf)
  * [TC39 Software Copyright Policy](http://www.ecma-international.org/memento/TC39%20experimental%20policy.htm)

If you wish to submit a proposal and are not a representative of a TC39 member, here are the steps you need to take:

  1. Read the  [TC39 process document](https://docs.google.com/document/d/1QbEE0BsO4lvl7NFTn5WXWeiEIBfaVUF7Dk0hpPpPDzU).
  2. [Register as a TC39 contributor](http://www.ecma-international.org/memento/register_TC39_Royalty_Free_Task_Group.php)
  3. Submit a pull request here for your strawman proposal.

## Developing the Specification

After cloning, do `npm install` to set up your environment. You can then do `npm run build` to build the spec or `npm run watch` to set up a continuous build. The results will appear in the `out` directory, which you can use `npm run clean` to delete.
