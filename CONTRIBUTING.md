# Contributing to ECMA-402

Thank you for your interest in improving ECMA-402, the ECMAScript's solution for internationalization.

## Ways to Contribute

### Bug Reports & Bug Fixes

File a bug or pull requests against the current text of ECMA402 in this repository. For more information, see [ecma262 CONTRIBUTING.md](https://github.com/tc39/ecma262/blob/master/CONTRIBUTING.md#issues-and-pull-requests).

If the fix is trivial you may not need to sign the CLA. If your fix is involved, signing the CLA will be required. See the "Patent Policy and CLA" section below.

### Feature Requests

Feature requests for future versions of ECMA402 should be made in this repository by creating a new issue. Your goal will be to convince others that your proposal is a useful addition to the language and recruit TC39 members to help turn your request into a proposal and shepherd it into the language.

See also "ECMA-402 Guidelines for Feature Requests and Proposals" below.

### Proposals

We follow the TC39 staging process for proposals.  See [ecma262 CONTRIBUTING.md](https://github.com/tc39/ecma262/blob/master/CONTRIBUTING.md#new-feature-proposals) for more information and steps to get started.

See also "ECMA-402 Guidelines for Feature Requests and Proposals" below.

## ECMA-402 Guidelines for Feature Requests and Proposals

The ECMA-402 standard should be as small and generic as possible to supply sufficient internationalization capabilities for JavaScript to lower the barrier to turn JavaScript application for global audience. The ECMA-402 Task Group tries to balance the never-ending stream of additions against the need to remain small, lean and stable for very long (10+ years) timeframe of maintenance.

In addition to the standard TC39 (ECMA-262) stage advancement requirements, ECMA-402 proposals are held against the following additional criteria.

### ECMA-402 Stage 2 Requirements

When the ECMA-402 subcommittee reviews proposals for *new features*, we hold them against the following list of criteria.  It is the reponsibility of the proposal champion to provide a compelling case that their feature request meets these criteria.

1. **Prior Art**
    1. Our job is to bring features that i18n experts have already solved to JavaScript developers, not to invent new solutions to those problems. We often reference CLDR, ICU, and Unicode as prior art.
    2. The data and algorithms specified in CLDR, ICU, and Unicode are of variable quality. In order to be adopted by ECMA-402, the prior art must be considered best i18n practice by consensus of the ECMA-402 standards committee.
2. **Expensive to Implement in Userland**
    1. Features in Intl must be significantly more efficient and less complex than a third-party library implementing the same feature. The champion can cite a heavy locale data dependency or a complex algorithm to satisfy this criterion.
3. **Broad Appeal**
    1. The champion must demonstrate that their feature request is needed by a large number of smaller web apps or a smaller number of high-profile web apps (Calendar, Travel Booking, etc).  As a rule of thumb, the champion should demonstrate that their new feature is at least as useful as an existing feature in ECMA-402.  The champion can provide npm module statistics or a list of user requests to satisfy this criterion.
    1. Alternatively, the champion can make a case that their feature is critical for a multilingual web, even if it lacks broad appeal.

The ECMA-402 subcommittee will also review proposals to *improve existing features*.  We will consider such proposals so long as the champion can demonstrate that their request will not make an ECMA-402 implementation substantially more complex.  If the request requires a nontrivial increase in locale data size, the committee will hold the request against the criteria for new features listed above.

### ECMA-402 Stage 3 Requirements

The ECMA-402 subcommittee does not want to substantially raise the bar for current and future implementations. In order for a proposal to be accepted as Stage 3, the proposal champion must demonstrate:

1. **Payload Mitigation**
    1. Not all proposals are equal; some may require large amounts of locale data. The proposal champion must verify with browser vendors that the proposal meets their standard for payload size increase. The proposal may need to be modified to reduce payload size increases if requested by browser vendors.

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
