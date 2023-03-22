I want to uppercase everything that does not reflect externally-defined names, i.e. stuff like
[[nu]]

TIMES
===
(fetch earlier from in document)
18:31 
19:31
===

done: [[LocaleMatcher]]
next:  [[locale]]

initial notes: this promises to be a hard one

plan: search (in spec) for all places it is used, figure out if anything used to select it depends on
potentially dynamic data

detail: 

1. find an abstract op / internal slot where it's used. 
2. look for where the slot -- CURRENT [[locale]] -- is used/populated
3. trace back where that data can come from by searching for every place the function containing the
   assingment is found

    a. trace back through each place found until certain that you know all places that the data
    could ultimately be coming from

    b. if DFS is complete and there is no place where it is set using [[<dynamic values>]] then
    we're golden. I do _not_ have to read the code terribly deeply to find this -- all I care about
    is whether data that will be used to set [[theslot]] cannot be set using dynamic values. 

    If yes, we're good, if no, we've got problems and will have to think of how to solve them. This
    may require reading code deeply, or maybe no?

9.2.3 LookupMatcher

1. see if requestedLocales (a List as returned by CanonicalizeLocalList) can be set dynamically

- look for all calls to LookupMatcher
- called by: 9.2.7 ResolveLocale (in negotiation.html)

-- 9.2.7 ResolveLocale
   - takes avalableLocales as a parameter used to call LookupMatcher
   - called by: 10.1.2  InitializeCollator
                        - creates requestedLocales with CanonicalizeLocaleList, which is safe (i.e.
                          can't access any of the slots we're trying to rename) 
                11.1.2  InitializeDateTimeFormat
                12.1.1  Intl.DisplayNames
                13.1.1  Intl.ListFormat
                15.1.2  InitializeNumberFormat
                16.1.2  InitializePluralRules
                17.1.2  InitializeRelativeTimeFormat
                18.1.1  Intl.Segmenter

NO this is stupid.

9:00

okay: I figure out what Object instances/Record instances have [[locale]] fields. I search *by name*
for those **instances**, looking for dynamic accesses.

Note: I don't have to worry about any use of [[locale]] that's _only_
dynamic: i.e. it's not my problem if the user has a string _s_
containing "locale" and at some point they say set r.[[<s>]] to "foo"
and somewhere else they say set _bar_ to r.[[<s>]], so long as at no
point do they have a non-dynamic access to r.[[locale]]

==
bespoke notation: if a record is created using a safe abstract op /
internal function, the call to that op/function will be wrapped in { }
and the op/function itself will be wrapped in { } in the list below.

if I've looked at an op/function but have doubts about it, the
op/function and calls to it will be wrapped in = =
==


Internal methods/Abstract ops using [[locale]]

-
9.2.3 {LookupMatcher} [SAFE]
-

creates a new Record _result_ with a [[locale]] field.
returns _result_ with no dynamic accesses --> it's safe!

-
9.2.7 {ResolveLocale} [SAFE]
-

uses the [[locale]] field of Record _r_ returned by {LookupMatcher} 
to create _foundLocale_. No dynamic accesses of _r_ . returns Record 


-
10.1.2 {InitializeCollator} [SAFE]

-
creates _r_, a Record returned by {ResolveLocale}, and uses
_r_.[[locale]]

creates Record _result_ containing [[locale]] slot intialized with
_foundLocale_, which is either _r_.[[locale]] or a value returned by
InsertUnicodeExtensionAndCanonicalize.  

No dynamic accesses of either _r_ or _result_

-
11.1.2 {InitializeDateTimeFormat} [RETURNS PARAMETER] (SAFE)
-
creates Record _r_ with value returned by {ResolveLocale}, which
contains field _r_.[[locale]]

returns an object called dateTimeFormat, initially taken as a
parameter. Does not perform any dynamic accesses of dateTimeFormat.

returns having performed no dynamic accesses of _r_'s



          (pick up here -- this was match 9 of 17) 10:21

          resumed 12:07

-
12.1.1 =Intl.DisplayNames= (SAFE)`
-
creates Record _r_ with value returned by {ResolveLocale}, which
contains field _r_.[[locale]]

does no dynamic access to _r_. 

returns displayNames, which 
  1: contains a field named [[Locale]], 
  2: has an field named [[Fields]] which contains names set via
  typeFields[[<style>]]. Hypothetically this could result in
  displayNames having one field named [[Locale]] and another named
  [[locale]]


- check how displayNames is used

- variables used for dynamic access can only be set to a limited list of values TOTALLY SAFE

-
13.1.1 {Intl.ListFormat} [SAFE]
-

creates Record _r_ with value returned by {ResolveLocale}, whih
contains field _r_.[[locale]]. Performs no dynamic accesses of _r_

Returns object _listFormat_ which contains [[Locale]] field. 
No dynamic accesses of _listFormat_


-
14.1.1 {Intl.Locale} [SAFE]
-

creates a Record _r_ by calling ApplyUnicodeExtensionToTag
accesses _r_.[[locale]]

does no dynamic access of _r_

returns _locale_, an Object with a [[Locale]] slot (among other
things), having done no dynamic access of _locale_

-
14.1.3 =ApplyUnicodeExtensionToTag= [SAFE]
-

returns Record _result_, which has a [[locale]] field

dynamic access of _result_ occurs: for each element _key_ of parameter
_relevantExtensionKeys_, check if _keywords_ contains an element with
[[Key]] the same as _key_. 

_options_ parameter must have a field [[<key>]]  <-- only valid values
are ones in _options_

after this, _result_.[[locale]]  is set to _locale_, which is a String
_tag_ that has all Unicode locale extension sequences removed. 

no dynamic access after that. 

potential (unlikely) danger: could [[<key>]] ever contain the value
"locale"? If so, uppercasing the name of the [[locale]] field used at
end of ApplyUnicodeExtensionToTag could result in _result_ having both
[[locale]] and [[Locale]]  

nope! <key> is drawn from [[RelevantExtensionKeys]], [[RelevantExtensionKeys]] is drawn from
%Locale%.[[RelevantExtensionKeys]], %Locale%.[[RelevantExtensionKeys]] must be language tag
extensions as defined in UTS 35, and [[locale]] can't be that.

** RETURN TO THIS ONE **


-
15.1.2 {InitializeNumberFormat} [RETURNS PARAMETER] [SAFE]
- 

creates Record _r_ returned by {ResolveLocale} 
performs no dynamic accesses on _r_

returns parameter _numberFormat_ (which has [[Locale]] field
initialized from _r_.[[locale]]) having done no dynamic accesses on
_numberFormat_

-
16.1.2 {InitializePluralRules} [RETURNS PARAMETER] [SAFE]
-

Creates Record _r_ returned by {ResolveLocale}. 

returns parameter _pluralRules_ with [[Locale]] set to r.[[locale]]

does no dynamic accesses of _pluralRules_ nor _r_


-
17.1.2 {InitializeRelativeTimeFormat} [RETURNS PARAMETER] [SAFE]
-

creates Record _r_ returned by {ResolveLocale}

sets Internal Slot [[Locale]] of parameter _relativeTimeFormat_ to
value of _r_.[[locale]]

performs no dynamic accesses of either _r_ or _relativeTimeFormat_

returns _relativeTimeFormat_

No change made to any slots in _relativeTimeFormat_


18.1.1 {Intl.Segmenter} [RETURNS PARAMETER] [SAFE!]

Creates record _r_ returned by {ResolveLocale}

Creates object _segmenter_
uses _r_.[[locale]] to initialize _segmenter_.[[Locale]]

performs no dynamic accesses of either _r_ or _relativeTimeFormat_
returns _segmenter_



end 13:30

next steps: verify that none of the ops/functions that return their
parameters have parameters that could have already had a field named
[[Locale]] 


14.1.3 look for potential dangers in =ApplyUnicodeExtensionToTag=




12:52




=START HERE=
23:00
23:43 14.1.3 look for potential dangers in =ApplyUnicodeExtensionToTag=
 LAST THING TO DO FOR THIS ONE -- PROMISES TO BE HARDEST 



 done!

 start 7:45
