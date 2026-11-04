# Contributing to Eclipse Tractus-X Starter Kit

Thank you for contributing! Start with the [README](README.md),
[installation and site preview instructions](INSTALL.md), and
[open issues](https://github.com/eclipse-tractusx/tractusx-starter-kit/issues).
Discuss substantial changes in an issue before implementation.

## Eclipse contribution process

This project follows the [Eclipse Development Process](https://www.eclipse.org/projects/dev_process/)
and [Eclipse IP Policy](https://www.eclipse.org/org/documents/Eclipse_IP_Policy.pdf).
Before contributing, sign the [Eclipse Contributor Agreement (ECA)](https://www.eclipse.org/legal/ECA.php).
Use the same email address for your Git commits and Eclipse account.
Sign off commits (`git commit -s`) in accordance with the
[Eclipse contributor guidance](https://www.eclipse.org/projects/handbook/#resources-commit).

Contributions are subject to the [Eclipse Terms of Use](https://www.eclipse.org/legal/termsofuse.php)
and our [Code of Conduct](CODE_OF_CONDUCT.md).

## Pull requests

1. Fork the repository and create a topic branch from `main`.
2. Keep changes focused, document behavior changes, and add tests when applicable.
3. Preview documentation locally as described in [INSTALL.md](INSTALL.md).
   There is no application build or automated test suite yet.
4. Check licensing and ensure no credentials or private configuration are committed.
5. Open a pull request against `main`, link the issue, and address CI and review feedback.

Report vulnerabilities privately as described in [SECURITY.md](SECURITY.md).
For questions, use the [Tractus-X developer mailing list](https://accounts.eclipse.org/mailing-list/tractusx-dev).

## Licenses and file headers

Code, workflows, and executable configuration use [Apache-2.0](LICENSE).
Documentation, images, and other non-code content use [CC-BY-4.0](LICENSE_non-code).
Keep existing copyright statements; use the actual creation year and copyright
holder for new files. See [TRG 7.02](https://eclipse-tractusx.github.io/docs/release/trg-7/trg-7-02)
and [TRG 7.07](https://eclipse-tractusx.github.io/docs/release/trg-7/trg-7-07).

For code, use this header in the file format's comment syntax:

```text
Copyright (c) 2026 Contributors to the Eclipse Foundation

See the NOTICE file(s) distributed with this work for additional
information regarding copyright ownership.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at
https://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.

SPDX-License-Identifier: Apache-2.0
```

For non-code source files that support comments, use:

```text
Copyright (c) 2026 Contributors to the Eclipse Foundation

See the NOTICE file(s) distributed with this work for additional
information regarding copyright ownership.

This work is made available under the terms of the
Creative Commons Attribution 4.0 International (CC-BY-4.0) license,
which is available at https://creativecommons.org/licenses/by/4.0/legalcode.

SPDX-License-Identifier: CC-BY-4.0
```

Documentation must also include a **visible** NOTICE with the license,
copyright holder, and source URL (as below); comments alone are insufficient.
Legal governance files are exempt from these headers. Attribute third-party
content and update [NOTICE.md](NOTICE.md) when introducing it.

## NOTICE

This work is licensed under [CC-BY-4.0](https://creativecommons.org/licenses/by/4.0/legalcode).

- SPDX-License-Identifier: CC-BY-4.0
- SPDX-FileCopyrightText: 2026 Contributors to the Eclipse Foundation
- Source URL: https://github.com/eclipse-tractusx/tractusx-starter-kit/blob/main/CONTRIBUTING.md
