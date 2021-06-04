How to hack on UserScripts
===========================

1. Check out the GitHub repository somewhere.

These can currently be installed from:
2. Remove any installed copies of the UserScript.
3. For TamperMonkey, go to the extension's properties ([chrome://extensions](chrome://extensions))
   and enable **Allow access to file URLs**.

![Chrome Screenshot](https://i.stack.imgur.com/dkHgL.png)

4. Add a new UserScript with the header copy/pasted, and an additional `@require` line in there.

It will look something like this, but be sure to double-check the
current headers at the time you're doing this! And be aware they may
change over time as they they include `@grant`s and `@match`es!

```
// ==UserScript==
// @name         (DEV) CDK GitHub Enhancements
// @namespace    http://rix0r.nl/
// @version      0.1
// @description  CDK Workflow Enhancements for GitHub
// @author       Rico
// @require      http://code.jquery.com/jquery-latest.js
// @require      file:///path/to/script/on/disk/scripts/CdkGitHubEnhancements.user.js
// @match        https://github.com/*
// @grant        GM.xmlHttpRequest
// @grant        GM_addStyle
// @grant        GM.openInTab
// @grant        GM.getValue
// @grant        GM.setValue
// ==/UserScript==
startGitHubIntegration('USERNAME', 'GITHUB_TOKEN');
```
