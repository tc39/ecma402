# Contributing to ECMA-402

Thank you for your interest in improving ECMA-402, the ECMAScript's solution for internationalization.

## Ways to Contribute

### Bug Reports & Bug Fixes

File a bug report or pull request against the current text of ECMA-402 in this repository. For more information, see [ECMA-262 CONTRIBUTING.md](https://github.com/tc39/ecma262/blob/HEAD/CONTRIBUTING.md#issues-and-pull-requests).

If the fix is trivial you may not need to sign the CLA. If your fix is involved, signing the CLA will be required. See the "Patent Policy and CLA" section below.

### Feature Requests

Feature requests for future versions of ECMA-402 should be made in this repository by creating a new [issue](https://github.com/tc39/ecma402/issues). Your goal will be to convince others that it is a useful addition and recruit TC39 members to help shepherd it into the specification.

See also [ECMA-402 Guidelines for Feature Requests and Proposals](#ecma-402-guidelines-for-feature-requests-and-proposals) below.

### Proposals

We follow the TC39 staging process for proposals.  See [ECMA-262 CONTRIBUTING.md](https://github.com/tc39/ecma262/blob/HEAD/CONTRIBUTING.md#new-feature-proposals) for more information and steps to get started.

See also [ECMA-402 Guidelines for Feature Requests and Proposals](#ecma-402-guidelines-for-feature-requests-and-proposals) below.

## ECMA-402 Guidelines for Feature Requests and Proposals

The ECMA-402 specification should be as small and generic as possible to supply sufficient internationalization capabilities for JavaScript developers producing applications with global audiences. The ECMA-402 Task Group tries to balance the never-ending stream of additions against the need to remain small, lean, and stable for maintenance time frames of 10+ years.

In addition to the usual TC39 (ECMA-262) stage advancement requirements, ECMA-402 proposals are held against the following additional criteria.

### ECMA-402 Stage 2 Requirements

When the [ECMA-402 task group (TC39-TG2)](https://www.ecma-international.org/task-groups/tc39-tg2/) reviews proposals for *new features*, we hold them against the following list of criteria.  It is the reponsibility of the proposal champion to provide a compelling case that their feature request meets these criteria.

1. **Prior Art**
    1. Our job is bringing to JavaScript developers solutions that <abbr>i18n</abbr> (internationalization) experts have already described, not inventing new solutions. We often reference [Unicode](https://unicode.org/), [CLDR](https://cldr.unicode.org/), and [ICU](https://icu.unicode.org/) as prior art.
    2. The data and algorithms specified in Unicode, CLDR, and ICU are of variable quality. In order to be adopted by ECMA-402, the prior art must be considered best practice by consensus of the task group.
2. **Expensive to Implement in Userland**
    1. Features in Intl must be significantly more efficient and less complex than a third-party library implementing the same feature. The champion can cite a heavy locale data dependency or a complex algorithm to satisfy this criterion.
3. **Broad Appeal**
    1. The champion must demonstrate that their feature request is needed by a large number of smaller web apps or a smaller number of high-profile web apps (Calendar, Travel Booking, etc).  As a rule of thumb, the champion should demonstrate that their new feature is at least as useful as an existing feature in ECMA-402.  The champion can provide npm module statistics or a list of user requests to satisfy this criterion.
    1. Alternatively, the champion can make a case that their feature is critical for a multilingual web, even if it lacks broad appeal.

The ECMA-402 task group will also review proposals to *improve existing features*.  We will consider such proposals so long as the champion can demonstrate that their request will not make an ECMA-402 implementation substantially more complex.  If the request requires a nontrivial increase in locale data size, we will hold the request against the criteria for new features listed above.

In addition to these requirements, a proposal must have an associated request for a [W3C i18n Review](https://www.w3.org/International/review-request) opened at least 3 weeks prior to the TG2 meeting at which it is seeking approval for Stage 2.

### ECMA-402 Stage 3 Requirements

The ECMA-402 task group does not want to substantially raise the bar for current and future implementations. In order for a proposal to be accepted as Stage 3, the proposal champion must demonstrate:

1. **Payload Mitigation**
    1. Not all proposals are equal; some may require large amounts of locale data. The proposal champion must verify with browser vendors that the proposal meets their standard for payload size increase. The proposal may need to be modified to reduce payload size increases if requested by browser vendors.

If the proposal has seen substantive changes since Stage 2, the aforementioned W3C i18n Review should also be updated to reflect those changes.

## Patent Policy and CLA

There are a number of ways to contribute to ECMA-402. How to actually contribute depends on what you want to accomplish. In many cases, you may be required to execute a CLA with Ecma. See the final section named *Signing the CLA* for more information on this.

Ecma TC39 accepts contributions from non-member individuals who have accepted the TC39 copyright and patent policies. Currently all ECMAScript related technical work is done by the TC39 RF TG (Royalty Free Task Group), for which the following IPR Policies apply:

  * [Ecma International RF Patent Policy](https://www.ecma-international.org/memento/Policies/Ecma_Royalty-Free_Patent_Policy_Extension_Option.htm)
  * [Ecma International Software Copyright Policy](https://www.ecma-international.org/memento/Policies/Ecma_Policy_on_Submission_Inclusion_and_Licensing_of_Software.htm) ([PDF](https://www.ecma-international.org/memento/Policies/Ecma_Policy_on_Submission_Inclusion_and_Licensing_of_Software.pdf))

### Signing the CLA

If you wish to submit a proposal and are not a representative of a TC39 member, here are the steps you need to take:

  1. Read the [TC39 process document](https://tc39.es/process-document/).
  2. [Register as a TC39 contributor](https://tc39.es/agreements/contributor/) (it is not necessary to submit the contribution as attachment to the form)
  3. Submit a pull request here for your strawman proposal.
