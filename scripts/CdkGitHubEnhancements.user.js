"use strict";
// ==UserScript==
// @name         CDK GitHub Enhancements
// @namespace    http://rix0r.nl/
// @version      0.1.1
// @description  CDK Workflow Enhancements for GitHub
// @author       Rico
// @require      http://code.jquery.com/jquery-latest.js
// @match        https://github.com/*
// @grant        GM.xmlHttpRequest
// @grant        GM.openInTab
// @grant        GM.getValue
// @grant        GM.setValue
// ==/UserScript==
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
function startGitHubIntegration(username, token) {
    'use strict';
    /**
     * Polyfill for old GM_addStyle (still exists in TamperMonkey but
     * got removed in GreaseMonkey 4).
     */
    function GM_addStyle(aCss) {
        let head = document.getElementsByTagName('head')[0];
        if (!head) {
            return null;
        }
        let style = document.createElement('style');
        style.setAttribute('type', 'text/css');
        style.textContent = aCss;
        head.appendChild(style);
        return style;
    }
    function waitForSelector(selector, cb) {
        if ($(selector).length > 0) {
            cb();
            return;
        }
        setTimeout(() => waitForSelector(selector, cb), 100);
    }
    function doIfFound(selector, cb) {
        if ($(selector).length > 0) {
            return cb($(selector));
        }
        else {
            console.log('Did not find selector: ' + selector);
        }
    }
    function createGithubButton(caption, primary) {
        const btn = $('<button type="button" class="btn btn-sm d-inline-block" aria-expanded="false" style:button"></button>').text(caption);
        if (primary) {
            btn.addClass('btn-primary');
        }
        return btn;
    }
    function createPopover() {
        const popover = $('<div class="cdk-overlay"></div>');
        const modal = $('<div class="cdk-form"></div>').appendTo(popover);
        const tabs = new Tabs(modal);
        const errorField = $('<div>').addClass('cdk-error').css({ display: 'none' }).appendTo(modal);
        $(document.body).append(popover);
        return {
            tabs,
            close: () => popover.remove(),
            showError: (msg) => {
                errorField.text(msg).show();
            },
        };
    }
    function parseCurrentGitHubLocation() {
        const parts = window.location.pathname.substr(1).split('/');
        return {
            repo: parts[0] + '/' + parts[1],
            issue: parts[2] === 'issues' || parts[2] === 'pull' ? parts[3] : undefined,
        };
    }
    function getGitHub(repo, thing) {
        return new Promise((ok, ko) => {
            GM.xmlHttpRequest({
                method: 'GET',
                url: 'https://api.github.com/repos/' + repo + '/' + thing,
                headers: {
                    Accept: 'application/vnd.github.v3+json',
                    Authorization: 'Basic ' + btoa(username + ':' + token),
                },
                onerror: ko,
                onload: (progress) => {
                    if (progress.status.toString().startsWith('2')) {
                        ok(JSON.parse(progress.responseText));
                    }
                    else {
                        ko(new Error('HTTP call failed: ' + progress.status + ' ' + progress.statusText));
                    }
                },
            });
        });
    }
    function postGitHub(repo, thing, data, method) {
        return new Promise((ok, ko) => {
            GM.xmlHttpRequest({
                method: method !== null && method !== void 0 ? method : 'POST',
                url: 'https://api.github.com/repos/' + repo + '/' + thing,
                data: JSON.stringify(data),
                headers: {
                    Accept: 'application/vnd.github.v3+json',
                    Authorization: 'Basic ' + btoa(username + ':' + token),
                },
                onerror: ko,
                onload: (progress) => {
                    if (progress.status.toString().startsWith('2')) {
                        ok(JSON.parse(progress.responseText));
                    }
                    else {
                        ko(new Error('HTTP call failed: ' + progress.status + ' ' + progress.statusText));
                    }
                },
            });
        });
    }
    function Table() {
        const table = $('<table></table>');
        table.addRow = function (...elements) {
            const row = $('<tr></tr>').appendTo(table);
            for (let el of arguments) {
                if (typeof el === 'string') {
                    el = document.createTextNode(el);
                }
                row.append($('<td></td>').append(el));
            }
        };
        return table;
    }
    function createNakedRadio(name, value) {
        const id = name + '-' + value;
        return $('<input type="radio">').attr('id', id).attr('name', name).attr('value', value);
    }
    function createRadioButton(name, value, caption) {
        const id = name + '-' + value;
        return [
            $('<input type="radio">').attr('id', id).attr('name', name).attr('value', value),
            $('<label></label>').attr('for', id).text(caption),
        ];
    }
    function createCheckBox(name, value, caption, checked = false) {
        return [
            $('<input type="checkbox">').attr('id', name).attr('name', name).attr('value', value).prop('checked', checked),
            $('<label></label>').attr('for', name).text(caption),
        ];
    }
    function issueLabels(issue) {
        return issue.labels.map(i => i.name);
    }
    /**
     * Determine a classification from the given labels and remove the used labels from the list
     */
    function classificationFromLabels(labels) {
        return {
            type: eat(labels, 'bug') ? 'bug' :
                eat(labels, 'feature-request') ? 'fr' :
                    eat(labels, 'guidance') ? 'guidance' :
                        undefined,
            prio: eat(labels, 'p1') ? 'p1' :
                eat(labels, 'p2') ? 'p2' :
                    undefined,
            size: eat(labels, 'effort/small') ? 's' :
                eat(labels, 'effort/medium') ? 'm' :
                    eat(labels, 'effort/large') ? 'l' :
                        undefined,
            gfi: eat(labels, 'good first issue'),
        };
    }
    function labelsFromClassification(classif) {
        const ret = [];
        switch (classif.type) {
            case 'bug':
                ret.push('bug');
                break;
            case 'fr':
                ret.push('feature-request');
                break;
            case 'guidance':
                ret.push('guidance');
                break;
        }
        switch (classif.prio) {
            case 'p1':
                ret.push('p1');
                break;
            case 'p2':
                ret.push('p2');
                break;
        }
        switch (classif.size) {
            case 's':
                ret.push('effort/small');
                break;
            case 'm':
                ret.push('effort/medium');
                break;
            case 'l':
                ret.push('effort/large');
                break;
        }
        if (classif.gfi) {
            ret.push('good first issue');
        }
        return ret;
    }
    function eat(list, element) {
        const i = list.indexOf(element);
        if (i > -1) {
            list.splice(i, 1);
            return true;
        }
        return false;
    }
    $(() => {
        const current = parseCurrentGitHubLocation();
        if (!current.issue) {
            console.log('Not an issue page.');
            return;
        }
        let LABEL_CACHE;
        function readAllLabels() {
            return __awaiter(this, void 0, void 0, function* () {
                if (LABEL_CACHE) {
                    return LABEL_CACHE;
                }
                return new Promise((ok, ko) => {
                    LABEL_CACHE = [];
                    function getPage(nr) {
                        return __awaiter(this, void 0, void 0, function* () {
                            try {
                                const page = yield getGitHub(current.repo, `labels?per_page=100&page=${nr}`);
                                LABEL_CACHE === null || LABEL_CACHE === void 0 ? void 0 : LABEL_CACHE.push(...page);
                                if (page.length < 100) {
                                    ok(LABEL_CACHE);
                                }
                                else {
                                    getPage(nr + 1);
                                }
                            }
                            catch (e) {
                                ko(e);
                            }
                        });
                    }
                    getPage(1);
                });
            });
        }
        function createQuickTriageButton() {
            return doIfFound('#partial-discussion-sidebar', sidebar => {
                return createGithubButton('Quick Triage').prependTo(sidebar).click(() => __awaiter(this, void 0, void 0, function* () {
                    const popover = createPopover();
                    const issue = yield getGitHub(current.repo, 'issues/' + current.issue);
                    const host = {
                        close() {
                            popover.close();
                        },
                        showError(message) {
                            popover.showError(message);
                        },
                        readAllLabels,
                        addComment(comment) {
                            return __awaiter(this, void 0, void 0, function* () {
                                yield postGitHub(current.repo, `issues/${current.issue}/comments`, {
                                    body: comment,
                                });
                            });
                        },
                        removeMyAssignment() {
                            return __awaiter(this, void 0, void 0, function* () {
                                yield postGitHub(current.repo, `issues/${current.issue}/assignees`, {
                                    assignees: [username],
                                }, 'DELETE');
                            });
                        },
                        updateLabels(labels) {
                            return __awaiter(this, void 0, void 0, function* () {
                                yield postGitHub(current.repo, 'issues/' + current.issue, {
                                    labels: labels.map(l => ({ name: l })),
                                });
                            });
                        },
                        confirm(cb) {
                            return () => __awaiter(this, void 0, void 0, function* () {
                                try {
                                    yield cb();
                                    this.close();
                                }
                                catch (e) {
                                    this.showError(e.message);
                                }
                            });
                        },
                        confirmCancel(container, caption, cb) {
                            const confirmBtn = createGithubButton(caption, true).on('click', host.confirm(() => __awaiter(this, void 0, void 0, function* () {
                                confirmBtn.prop('disabled', true);
                                try {
                                    yield cb();
                                }
                                finally {
                                    confirmBtn.prop('disabled', false);
                                }
                            })));
                            container.append(confirmBtn);
                            container.append(createGithubButton('Cancel').on('click', () => host.close()));
                        }
                    };
                    addClassifyForm(popover.tabs.addTab('Code Issue'), issue, host);
                    addResponseRequestedForm(popover.tabs.addTab('Request Clarification'), issue, host);
                }));
            });
        }
        // GitHub sometimes does client-side page rebuilds (when you post a comment etc) which removes our
        // button. Periodically check if it's still there and recreate it if not.
        let button = createQuickTriageButton();
        setInterval(() => {
            if (button && !isAttachedToDOM(button)) {
                button = createQuickTriageButton();
            }
        }, 1000);
    });
    function isAttachedToDOM(ref) {
        return ref.parents(":last").is("html");
    }
    function addClassifyForm(container, issue, host) {
        const labels = issueLabels(issue);
        const classif = classificationFromLabels(labels);
        console.log(issue);
        const form = Table();
        form.addRow('Type', [
            ...createRadioButton('type', 'bug', 'Bug'),
            ...createRadioButton('type', 'fr', 'Feature'),
            ...createRadioButton('type', 'guidance', 'Guidance'),
        ]);
        const grid = Table().addClass('grid');
        grid.addRow('', 'Small', 'Medium', 'Large');
        grid.addRow('P1', createNakedRadio('klz', 'p1-s'), createNakedRadio('klz', 'p1-m'), createNakedRadio('klz', 'p1-l'));
        grid.addRow('P2', createNakedRadio('klz', 'p2-s'), createNakedRadio('klz', 'p2-m'), createNakedRadio('klz', 'p2-l'));
        form.addRow('Classification', grid);
        form.addRow('', createCheckBox('gfi', 'gfi', 'Good first issue'));
        form.addRow('', createCheckBox('unassign', 'unassign', 'Unassign me', true));
        form.addRow('Comment', $('<textarea>').attr('rows', 3).attr('id', 'comment').css({ width: '100%' }));
        // UI from Classification
        form.find(`[id=type-${classif.type}]`).prop('checked', true);
        form.find(`[id=klz-${classif.prio}-${classif.size}]`).prop('checked', true);
        if (classif.gfi) {
            form.find(`[id=gfi]`).prop('checked', true);
        }
        container.append(form);
        host.confirmCancel(container, 'Classify', () => __awaiter(this, void 0, void 0, function* () {
            var _a;
            // Classification from UI
            const klz = (_a = form.find("input[name='klz']:checked").val()) === null || _a === void 0 ? void 0 : _a.split('-');
            const newClassif = {
                type: form.find("input[name='type']:checked").val(),
                prio: klz === null || klz === void 0 ? void 0 : klz[0],
                size: klz === null || klz === void 0 ? void 0 : klz[1],
                gfi: form.find("input[name='gfi']:checked").prop('checked'),
            };
            const unassignMe = form.find('input[name=unassign]').prop('checked');
            const addComment = form.find('#comment').val();
            const newLabels = [...labels, ...labelsFromClassification(newClassif)]
                // Remove needs-triage as well
                .filter(n => n !== 'needs-triage');
            console.log(newClassif, newLabels);
            yield host.updateLabels(newLabels);
            if (unassignMe && issue.assignees.some((a) => a.login === username)) {
                yield host.removeMyAssignment();
            }
            if (addComment) {
                yield host.addComment(addComment);
            }
        }));
    }
    function addResponseRequestedForm(container, issue, host) {
        const form = Table();
        form.addRow('Comment', $('<textarea>').attr('rows', 3).attr('cols', 40).attr('id', 'comment'));
        container.append(form);
        host.confirmCancel(container, 'Request response', () => __awaiter(this, void 0, void 0, function* () {
            const addComment = form.find('#comment').val();
            if (addComment) {
                yield host.addComment(addComment);
            }
            const allLabels = yield host.readAllLabels();
            const labels = issueLabels(issue);
            const rrLabel = allLabels.find(l => l.name.toLowerCase().includes('response') && l.name.toLowerCase().includes('request'));
            if (rrLabel && !labels.includes(rrLabel.name)) {
                labels.push(rrLabel.name);
            }
            yield host.updateLabels(labels);
        }));
    }
    //--- Style our newly added elements using CSS.
    GM_addStyle(`
.cdk-overlay {
  position: fixed; /* Sit on top of the page content */
  width: 100%; /* Full width (cover the whole page) */
  height: 100%; /* Full height (cover the whole page) */
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0,0,0,0.7);
  z-index: 2000;

  font-size: 12pt;
  font-family: sans-serif;

  display: flex;
  justify-content: center;
  align-items: center;
}

.cdk-form {
  box-sizing: border-box;

  height: auto;
  width: 30em;
  margin: 0 auto;

  padding: 10px 20px;

  background: #f2f3f3;
  border: solid 1px grey;
}

.cdk-form .UnderlineNav {
    margin-left: -20px;
    margin-right: -20px;
    margin-top: -10px;
}

.cdk-form .cdk-error {
    border: solid 1px red;
    color: red;
    padding: 0.5em;
    margin: 0.5em 0em;
}

.cdk-form td {
    padding: 0.2em 0.5em;
}

.cdk-form input {
    margin-right: 0.2em;
}

.cdk-form label {
    margin-right: 1em;
}

.cdk-form .grid {
    background-color: white;
}

.cdk-form .grid td {
    text-align: center;
    font-weight: bold;
}

.cdk-form .UnderlineNav-item {
    cursor: pointer;
}

.cdk-form .grid input[type="radio"] {
    width: 1em;
    height: 1em;
}

.cdk-form textarea {
  width: 100%;
}
`);
}
/**
 * Tabs, borrowing styles from the containing GitHub page
 */
class Tabs {
    constructor(container) {
        this.first = true;
        this.tabContainer = $('<ul>').addClass('UnderlineNav').addClass('list-style-none').appendTo(container);
        this.bodyContainer = $('<div>').css({ marginTop: 10 }).appendTo(container);
    }
    addTab(title) {
        const titleEl = $('<li>').addClass('d-inline-flex').addClass('UnderlineNav-item').appendTo(this.tabContainer).text(title);
        const bodyEl = $('<div>').appendTo(this.bodyContainer);
        titleEl.on('click', () => {
            this.flipTo(titleEl, bodyEl);
        });
        if (this.first) {
            titleEl.addClass('selected');
        }
        else {
            titleEl.hide();
            bodyEl.hide();
        }
        this.first = false;
        return bodyEl;
    }
    flipTo(titleEl, bodyEl) {
        $(this.tabContainer).children().removeClass('selected');
        titleEl.addClass('selected');
        $(this.bodyContainer).children().hide();
        bodyEl.show();
    }
}
