# Open questions

This file contains questions we don't yet have the answers for. When we find the answer to one of these questions, we will add it to the appropriate documentation and remove it from this file.

## 1. How do we handle `version_monotonic` on

`point_versions` when releases can go out in any chronologic order?

For example, imagine you have this release history, in chronologic order and correct semantic order, making
`version_monotonic` also match the semantic and chronologic orders:

1. v1.0.0
2. v1.1.0
3. v2.0.0

Now, imagine you release two new versions of the package:

4. v2.1.0
5. v1.1.0-hotfix.0

or:

4. v1.1.0-hotfix.0
5. v2.1.0

In either of these examples, your `version_monotonic` order no longer matches the semantic order.
If we rely only on the
`version_monotonic` for use case association and whatever else, we could end up
in a world where we forward-propagate a use case from newer semantic versions to older semantic versions.