# cdk-greasemonkey

GreaseMonkey scripts for CDK ticket workflows.

How to install
--------------

1. Check out the GitHub repository somewhere.
2. For TamperMonkey, go to the extension's properties ([chrome://extensions](chrome://extensions))
   and enable **Allow access to file URLs**.

![Chrome Screenshot](https://i.stack.imgur.com/dkHgL.png)

3. Add a new UserScript with the header below.

Take note that you must update the `@require` line below and the `startGitHubIntegration`
line with your usename and GitHub token.

```
// ==UserScript==
// @name         (Local) CDK GitHub Enhancements
// @namespace    http://rix0r.nl/
// @version      0.1
// @description  CDK Workflow Enhancements for GitHub
// @author       Rico
// @require      http://code.jquery.com/jquery-latest.js
// @require      file:///PATH/TO/SCRIPT/ON/DISK/scripts/CdkGitHubEnhancements.user.js
// @match        https://github.com/*
// @grant        GM.xmlHttpRequest
// @grant        GM_addStyle
// @grant        GM.openInTab
// @grant        GM.getValue
// @grant        GM.setValue
// ==/UserScript==
startGitHubIntegration('USERNAME', 'GITHUB_TOKEN');
```
