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

function startGitHubIntegration(username, token) {
    'use strict';

    /**
     * Polyfill for old GM_addStyle (still exists in TamperMonkey but
     * got removed in GreaseMonkey 4).
     */
    function GM_addStyle(aCss) {
        let head = document.getElementsByTagName('head')[0];
        if (!head) { return null; }
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
        } else {
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

    function addTButton() {
        const btn = $('<button class="awsui-button awsui-button-variant-normal awsui-hover-child-icons" type="submit" override-focus="" style="margin-left: 10px;"><span awsui-button-region="text">Copy to GitHub</span></button>');
        btn.click(() => {
            openGitHubWindow({
                title: $('#sim-title').text(),
                body: $('.sim-overview .plain-text-display').text(),
            });
        });
        $('.interaction-buttons').append(btn);
    }

    async function openGitHubWindow(opts) {
        let titleField;
        let bodyField;
        let submitButton;
        let userNameField;
        let tokenField;
        let errorField;

        const auth = JSON.parse(await GM.getValue('auth', '{}'));

        const body = [
            opts.body || '',
            '',
            'From: ' + window.location.href,
        ].join('\n');

        const popover = $('<div class="cdk-overlay"></div>').append(
            $('<div class="cdk-form"></div>').append(
                $('<div>').text('Title'),
                titleField = $('<input type="text" style="width: 100%">').val(opts.title || ''),
                $('<div>').text('Body'),
                bodyField = $('<textarea>').val(body),
                errorField = $('<div>').addClass('cdk-error').css({ display: 'none' }),
                submitButton = $('<button class="cdk-primary">').text('Copy to GitHub').click(async () => {
                    submitButton.attr('disabled', true);
                    errorField.hide();

                    try {
                        const auth = {
                            username: userNameField.val(),
                            token: tokenField.val(),
                        };

                        if (!auth.username) { throw new Error('Enter a username'); }
                        if (!auth.token) { throw new Error('Enter a Personal Access Token'); }

                        const result = await createGitHubIssue({
                            title: titleField.val(),
                            body: bodyField.val(),
                            ...auth,
                        });
                        GM.openInTab(result.html_url, false);
                        await GM.setValue('auth', JSON.stringify(auth));
                        popover.remove();
                    } catch (e) {
                        submitButton.attr('disabled', false);
                        errorField.text(e.message).show();
                    }
                }),
                $('<button>').text('Cancel').click(() => {
                    popover.remove();
                }),
                $('<div>').css({ fontSize: '70%' }).append(
                    $('<div>').text('Username'),
                    userNameField = $('<input type="text">').val(auth.username),
                    $('<div>').text('GitHub Token'),
                    tokenField = $('<input type="text">').val(auth.token),
                ),
            )
        );
        $(document.body).append(popover);
    }

    function createPopover() {
        const popover = $('<div class="cdk-overlay"></div>');
        const form = $('<div class="cdk-form"></div>').appendTo(popover);
        const errorField = $('<div>').addClass('cdk-error').css({ display: 'none' }).appendTo(form);
        $(document.body).append(popover);
        return {
            form,
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
                    } else {
                        ko(new Error('HTTP call failed: ' + progress.status + ' ' + progress.statusText));
                    }
                },
            });
        });
    }

    function postGitHub(repo, thing, data, method) {
        return new Promise((ok, ko) => {
            GM.xmlHttpRequest({
                method: method ?? 'POST',
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
                    } else {
                        ko(new Error('HTTP call failed: ' + progress.status + ' ' + progress.statusText));
                    }
                },
            });
        });
    }

    function Table() {
        const table = $('<table></table>');

        table.addRow = function(elements) {
            const row = $('<tr></tr>').appendTo(table);
            for (let el of arguments) {
                if (typeof el === 'string') {
                    el = document.createTextNode(el);
                }

                row.append($('<td></td>').append(el));
            }
        }

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

    function createCheckBox(name, value, caption, checked) {
        return [
            $('<input type="checkbox">').attr('id', name).attr('name', name).attr('value', value).attr('checked', checked),
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
        }
    }

    function labelsFromClassification(classif) {
        const ret = [];
        switch (classif.type) {
            case 'bug': ret.push('bug'); break;
            case 'fr': ret.push('feature-request'); break;
            case 'guidance': ret.push('guidance'); break;
        }

        switch (classif.prio) {
            case 'p1': ret.push('p1'); break;
            case 'p2': ret.push('p2'); break;
        }

        switch (classif.size) {
            case 's': ret.push('effort/small'); break;
            case 'm': ret.push('effort/medium'); break;
            case 'l': ret.push('effort/large'); break;
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

        function createQuickTriageButton() {
            return doIfFound('#partial-discussion-sidebar', sidebar => {
                return createGithubButton('Quick Triage').prependTo(sidebar).click(async () => {
                    const popover = createPopover();

                    const issue = await getGitHub(current.repo, 'issues/' + current.issue);
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
                    grid.addRow('P1',
                                createNakedRadio('klz', 'p1-s'),
                                createNakedRadio('klz', 'p1-m'),
                                createNakedRadio('klz', 'p1-l'));
                    grid.addRow('P2',
                                createNakedRadio('klz', 'p2-s'),
                                createNakedRadio('klz', 'p2-m'),
                                createNakedRadio('klz', 'p2-l'));

                    form.addRow('Classification', grid);

                    form.addRow('', createCheckBox('gfi', 'gfi', 'Good first issue'));
                    form.addRow('', createCheckBox('unassign', 'unassign', 'Unassign me', true));

                    form.addRow('Comment', $('<textarea>').attr('rows', 3).attr('id', 'comment'));

                    // UI from Classification
                    form.find(`[id=type-${classif.type}]`).attr('checked', true);
                    form.find(`[id=klz-${classif.prio}-${classif.size}]`).attr('checked', true);
                    if (classif.gfi) {
                        form.find(`[id=gfi]`).attr('checked', true);
                    }

                    popover.form.append(form);
                    popover.form.append(createGithubButton('Confirm', true).click(async () => {
                        try {
                            // Classification from UI
                            const klz = form.find("input[name='klz']:checked").val()?.split('-');
                            const newClassif = {
                                type: form.find("input[name='type']:checked").val(),
                                prio: klz?.[0],
                                size: klz?.[1],
                                gfi: form.find("input[name='gfi']:checked").attr('checked'),
                            };
                            const unassignMe = form.find('input[name=unassign]').attr('checked');
                            const addComment = form.find('#comment').val();

                            const newLabels = [...labels, ...labelsFromClassification(newClassif)]
                            // Remove needs-triage as well
                                .filter(n => n !== 'needs-triage');


                            console.log(newClassif, newLabels);

                            await postGitHub(current.repo, 'issues/' + current.issue, {
                                labels: newLabels.map(l => ({
                                                            name: l
                                })),
                            });

                            if (unassignMe && issue.assignees.some(a => a.login === username)) {
                                await postGitHub(current.repo, `issues/${current.issue}/assignees`, {
                                    assignees: [username],
                                }, 'DELETE');
                            }

                            if (addComment) {
                                await postGitHub(current.repo, `issues/${current.issue}/comments`, {
                                    body: addComment,
                                });
                            }

                            popover.close();
                        } catch(e) {
                            popover.showError(e.message);
                        }
                    }));
                    popover.form.append(createGithubButton('Cancel').click(() => popover.close()));
                });
            });
        }

        // GitHub sometimes does client-side page rebuilds (when you post a comment etc) which removes our
        // button. Periodically check if it's still there and recreate it if not.
        let button = createQuickTriageButton();

        setInterval(() => {
            if (!isAttachedToDOM(button)) {
                button = createQuickTriageButton();
            }
        }, 1000);
    });

    function isAttachedToDOM(ref) {
        return ref.parents(":last").is("html");
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

.cdk-form .grid input[type="radio"] {
    width: 1em;
    height: 1em;
}

.cdk-form textarea {
  width: 100%;
}
` );
}
