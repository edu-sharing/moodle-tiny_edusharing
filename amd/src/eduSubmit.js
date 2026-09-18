// This file is part of Moodle - https://moodle.org/
//
// Moodle is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.
//
// Moodle is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU General Public License for more details.
//
// You should have received a copy of the GNU General Public License
// along with Moodle.  If not, see <https://www.gnu.org/licenses/>.

/**
 * Script eduSubmit.js
 *
 * @module      tiny_edusharing/eduSubmit
 * @copyright   2024 metaVentis GmbH <http://metaventis.com>
 * @license     https://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 *
 * This script contains all logic to be executed when the user saves the changes they made in the editor
 * by clicking the "save changes" button.
 * It also contains the logic for keeping the score of es elements already present in the section opened.
 */

import {getCourseId, getRepoId} from "./options";
import {addEduSharingInstance, deleteEduSharingInstance, updateInstance} from "./repository";
import {get_string as getString} from 'core/str';
import Config from 'core/config';
import Modal from 'core/modal';
import {component} from './common';
import {renderForPromise} from 'core/templates';

const formEditorsMap = new WeakMap();

// Per-editor initial elements.
const initialElementsMap = new WeakMap();

// Allowed widget attributes
const widgetAttributeWhitelist = [
    'context-node-id',
    'widget-type',
    'node-id',
    'propagated-node-id',
    'config-overwrite',
    'search-text'
];

// Widget types moodle can render. Repositories emit the content teaser under both names.
const supportedWidgetTypes = [
    'content-teaser',
    'wlo-content-teaser'
];

export const initEventHandler = (editor) => {
    const container = editor.getContainer();
    const form = container.closest("form");
    if (form !== null && typeof form.submit === "function") {
        let editors = formEditorsMap.get(form);
        if (!editors) {
            editors = new Set();
            formEditorsMap.set(form, editors);
        }
        editors.add(editor);

        if (!form.dataset.esSubmitHook) {
            form.dataset.esSubmitHook = "1";
            form.addEventListener('submit', async(event) => {
                if (form.dataset.esBypassSubmit === "1") {
                    delete form.dataset.esBypassSubmit;
                    return;
                }
                const submitter = event.submitter;
                if (!submitter || (submitter.id !== "id_submitbutton" && submitter.id !== "id_submitbutton2")) {
                    return;
                }
                event.preventDefault();

                // Disable the submit buttons while our custom conversion logic runs, so a second
                // click cannot re-enter this handler and create duplicate edusharing usages.
                const submitButtons = [
                    form.querySelector('#id_submitbutton'),
                    form.querySelector('#id_submitbutton2'),
                ].filter(Boolean);
                const previouslyDisabled = new Map(submitButtons.map(btn => [btn, btn.disabled]));
                submitButtons.forEach(btn => {
                    btn.disabled = true;
                });

                const formEditors = formEditorsMap.get(form) || new Set();
                // Ids of usages created during this submit attempt, so an unexpected failure
                // can roll them back instead of orphaning them in the repository.
                const submitContext = {createdInstances: []};
                const releaseButtons = () => {
                    submitButtons.forEach(btn => {
                        btn.disabled = previouslyDisabled.get(btn) ?? false;
                    });
                };
                try {
                    await Promise.all([...formEditors].map(editor => convertForSubmit(editor, submitContext)));
                } catch (error) {
                    // Per-object failures are handled inside convertForSubmit, so getting here means
                    // something unexpected broke mid-conversion. Submitting now would persist
                    // half-converted markup and leave the already created usages orphaned.
                    window.console.error(error);
                    await rollbackCreatedUsages(submitContext.createdInstances);
                    await showFailureModal(
                        await getString('unexpectedSubmitErrorTitle', component),
                        '<p>' + await getString('unexpectedSubmitErrorInfo', component) + '</p>'
                    );
                    releaseButtons();
                    return;
                }
                releaseButtons();
                form.dataset.esBypassSubmit = "1";
                if (submitter.id === "id_submitbutton") {
                    const hidden = document.createElement('input');
                    hidden.type = 'hidden';
                    hidden.name = 'submitbutton';
                    hidden.value = '1';
                    form.appendChild(hidden);
                }
                form.submit();
            });
        }
    }
};

/**
 * Deletes the usages created during a submit attempt that is being aborted, so that a
 * failed save does not leave orphaned usages behind in the repository.
 *
 * @param {Array<{id: number, courseId: number}>} createdInstances
 * @returns {Promise<void>}
 */
const rollbackCreatedUsages = async(createdInstances) => {
    for (const instance of createdInstances) {
        try {
            await deleteEduSharingInstance({
                eduDeleteStructure: {
                    id: instance.id,
                    courseId: instance.courseId
                }
            });
        } catch (error) {
            window.console.error(error);
        }
    }
};

/**
 * Resolves a webservice rejection into a message that can be shown to the user.
 *
 * Moodle's core/ajax rejects with an object carrying the localised `message` of the
 * moodle_exception thrown server side, which is exactly the reason we want to display.
 *
 * @param {object|null} error
 * @returns {Promise<string>}
 */
const describeFailure = async(error) => error?.message || await getString('usageFailureUnknownReason', component);

/**
 * Removes an edu-sharing element from the content.
 *
 * New style elements are wrapped in a div.edusharing-placeholder that also holds the
 * caption, so the whole wrapper has to go. Legacy atto elements have no wrapper - their
 * surrounding paragraph may hold unrelated text and must never be removed.
 *
 * @param {HTMLElement} domNode
 * @returns {void}
 */
const dropElement = (domNode) => {
    const wrapper = domNode.closest?.('.edusharing-placeholder');
    (wrapper ?? domNode).remove();
};

/**
 * Renders a list of failures as an HTML list, each entry naming the object and its reason.
 *
 * @param {string} leadIn - Already translated introductory sentence.
 * @param {Array<{title: string, reason: string}>} failures
 * @returns {string}
 */
const renderFailureList = (leadIn, failures) => {
    const escape = value => {
        const holder = document.createElement('div');
        holder.textContent = value ?? '';
        return holder.innerHTML;
    };
    const items = failures
        .map(failure => '<li><strong>' + escape(failure.title) + '</strong>: ' + escape(failure.reason) + '</li>')
        .join('');
    return '<p>' + leadIn + '</p><ul>' + items + '</ul>';
};

/**
 * Shows a modal with a single confirm button and resolves once the user dismisses it.
 *
 * @param {string} title - Already translated title.
 * @param {string} body - HTML body.
 * @returns {Promise<void>}
 */
const showFailureModal = async(title, body) => {
    const modal = await Modal.create({
        title: title,
        body: body,
        footer: '<button type="button" class="btn btn-primary" data-action="confirm">OK</button>',
        show: true,
        removeOnClose: true
    });
    await new Promise((resolve) => {
        modal.getRoot().on('click', '[data-action="confirm"]', resolve);
        modal.getRoot().on('hidden.bs.modal', resolve);
    });
};

const convertForSubmit = async(editor, submitContext = {createdInstances: []}) => {
    const initialElements = initialElementsMap.get(editor) || [];
    const courseId = parseInt(getCourseId(editor));
    let showIframeRemovalDialog = false;
    let removedWidgets = [];
    // Objects whose usage could not be created; they get dropped from the content.
    let failedInsertions = [];
    // Objects whose update could not be saved; they stay in the content unchanged.
    let failedUpdates = [];
    /**
     * Recursively processes a DOM node and its children to handle specific cases related to
     * ES embedding in various elements such as images, links, iframes, and text nodes. This function
     * applies different processing strategies based on the type and attributes of each element encountered.
     *
     * @async
     * @function iterateAsync
     * @param {Node} domNode - The root DOM node to start the processing from. The function will recursively
     *                         process all child nodes and handle specific cases based on node type and attributes.
     * @returns {Promise<void>} A promise that resolves when all nodes in the subtree have been processed.
     */

    const iterateAsync = async domNode => {
        /**
         * Processes an added or edited ES DOM element. The function determines whether the element is new or updated
         * based on its attributes and performs the required backend operations via AJAX calls. If the element is updated,
         * it sends an update request. If the element is new, it sends a creation request and updates the DOM accordingly.
         *
         * @async
         * @function
         * @param {HTMLElement} domNode - The DOM node representing the element to process. This can be an image
         * or a link element, which contains all necessary attributes for identifying and processing.
         */
        const processAddedOrEditedElement = async(domNode) => {
            let link = domNode.getAttribute(domNode.nodeName.toLowerCase() === 'img' ? 'src' : 'href');
            let uri;
            try {
                uri = new URL(link);
            } catch (error) {
                // A placeholder we cannot parse carries no object to register, so drop it and
                // report it rather than blocking the whole save.
                window.console.error(error);
                failedInsertions.push({
                    title: domNode.getAttribute('title') ?? '',
                    reason: await describeFailure(null)
                });
                dropElement(domNode);
                return;
            }
            let searchParams = uri.searchParams;
            // Used to name the object in the failure report, so fall back to the title attribute.
            const objectTitle = searchParams.get('title') || domNode.getAttribute('title') || '';
            let indexOfElement = initialElements.indexOf(parseInt(searchParams.get('resourceId')));
            if (indexOfElement >= 0) {
                initialElements.splice(indexOfElement, 1);
                if (domNode.getAttribute('data-edited') !== null && domNode.getAttribute('data-edited') !== "") {
                    let ajaxParams = {
                        eduStructure: {
                            id: parseInt(searchParams.get('resourceId')),
                            courseId: courseId,
                            objectUrl: searchParams.get('object_url')
                        }
                    };
                    try {
                        const response = await updateInstance(ajaxParams);
                        if (response.id === undefined) {
                            throw new Error('');
                        }
                        domNode.removeAttribute('data-edited');
                    } catch (error) {
                        // The object itself is already saved, so it is kept as it is. The
                        // data-edited flag stays in place so the change can be retried.
                        window.console.error(error);
                        failedUpdates.push({
                            title: objectTitle,
                            reason: await describeFailure(error)
                        });
                    }
                }
            } else {
                let ajaxParams = {
                    eduStructure: {
                        name: searchParams.get('title'),
                        objectUrl: searchParams.get('object_url'),
                        courseId: courseId,
                        objectVersion: searchParams.get('window_version')
                    }
                };
                let response;
                try {
                    response = await addEduSharingInstance(ajaxParams);
                } catch (error) {
                    window.console.error(error);
                    failedInsertions.push({
                        title: objectTitle,
                        reason: await describeFailure(error)
                    });
                    dropElement(domNode);
                    return;
                }
                if (response.id === undefined) {
                    failedInsertions.push({
                        title: objectTitle,
                        reason: await describeFailure(null)
                    });
                    dropElement(domNode);
                    return;
                }
                submitContext.createdInstances.push({id: response.id, courseId: courseId});
                let isImage = domNode.nodeName.toLowerCase() === 'img';
                let previewUrl = `${Config.wwwroot}/mod/edusharing/preview.php`
                    + '?resourceId=' + response.id + '&' + searchParams.toString();
                domNode.setAttribute(isImage ? 'src' : 'href', previewUrl);
            }
        };
        /**
         * Processes a DOM text node, replacing or removing ES embedding iFrame elements.
         *
         * This function examines the text content of a given DOM node, parses it into a temporary div,
         * and processes iframe elements that match specific criteria. If the iframe's `data-repo-id` attribute
         * matches the connected repository, it replaces the iframe with new content or removes it if no replacement is available.
         * Once processing is complete, it replaces the original DOM node with the updated content.
         *
         * @async
         * @function
         * @param {Node} domNode - The DOM node containing the text content to be processed.
         * @returns {Promise<void>} - A promise that resolves when the processing is complete.
         */
        const processTextNode = async(domNode) => {
            const tempDiv = document.createElement('div');
            // A widget or an embedding iframe pasted into the editor survives tinyMCE's schema
            // as escaped text, so the markup has to be parsed to be found at all. DOMParser
            // does that inertly - it runs no scripts and fetches no subresources - which
            // assigning innerHTML would not.
            const parsed = new DOMParser().parseFromString(domNode.textContent, 'text/html');
            tempDiv.append(...Array.from(parsed.body.childNodes).map(node => document.importNode(node, true)));
            const iframes = tempDiv.querySelectorAll('iframe.es-embed-iframe');
            for (const iframe of iframes) {
                if (iframe.getAttribute('data-repo-id') === getRepoId(editor)) {
                    const failureCount = failedInsertions.length;
                    const replacement = await getIframeReplacementContent(
                        editor, iframe, failedInsertions, submitContext.createdInstances);
                    if (replacement !== '') {
                        iframe.outerHTML = replacement;
                    } else {
                        iframe.remove();
                        // Only fall back to the generic notice when no concrete reason was recorded.
                        if (failedInsertions.length === failureCount) {
                            showIframeRemovalDialog = true;
                        }
                    }
                } else {
                    iframe.remove();
                    showIframeRemovalDialog = true;
                }
            }
            const widgets = tempDiv.querySelectorAll('edu-sharing-generic-widget');
            for (const widget of widgets) {
                try {
                    const payload = toWidgetPayload(widget);
                    const replacement = await renderForPromise(`${component}/widget`, {widgetData: payload});
                    widget.outerHTML = replacement.html;
                } catch (e) {
                    widget.remove();
                    removedWidgets.push(e.message.split(':').pop());
                }
            }
            if (iframes.length > 0 || widgets.length > 0) {
                domNode.replaceWith(...tempDiv.childNodes);
            }
        };
        /**
         * Asynchronously processes an iframe DOM node, replacing or removing it based on the replacement content.
         *
         * This function takes a DOM node representing an iframe, retrieves its replacement content asynchronously,
         * and updates the DOM in one of the following ways:
         * - Replaces the iframe's outer HTML with the retrieved replacement content if the content is not an empty string.
         * - Removes the iframe from the DOM if the replacement content is an empty string.
         *
         * @param {HTMLElement} domNode - The iframe DOM node to be processed.
         * @returns {Promise<void>} A promise that resolves when the processing is complete.
         */
        const processIframe = async(domNode) => {
            const failureCount = failedInsertions.length;
            const replacement = await getIframeReplacementContent(
                editor, domNode, failedInsertions, submitContext.createdInstances);
            if (replacement !== '') {
                domNode.outerHTML = replacement;
            } else {
                domNode.remove();
                // Only fall back to the generic notice when no concrete reason was recorded.
                if (failedInsertions.length === failureCount) {
                    showIframeRemovalDialog = true;
                }
            }
        };
        /**
         * Asynchronously processes a widget contained within a DOM node.
         *
         * This function performs operations related to the provided DOM node,
         * enabling interaction or manipulation of the widget represented.
         *
         * @async
         * @param {HTMLElement} domNode - The DOM node containing the widget to process.
         * @returns {Promise<void>} A promise that resolves when the processing is complete.
         */
        const processWidget = async(domNode) => {
            try {
                const payload = toWidgetPayload(domNode);
                const renderedTemplate = await renderForPromise(`${component}/widget`, {
                    widgetData: payload
                });
                domNode.outerHTML = renderedTemplate.html;
            } catch (e) {
                domNode.remove();
                removedWidgets.push(e.message.split(':').pop());
            }
        };
        if (domNode.hasChildNodes()) {
            // childNodes is live: snapshot it, otherwise removing a node while processing it
            // makes the iteration skip its next sibling.
            for (const node of Array.from(domNode.childNodes)) {
                await iterateAsync(node);
            }
        }
        if (domNode.classList !== undefined && domNode.classList.contains('edusharing_atto')) {
            await processAddedOrEditedElement(domNode);
        }
        if (domNode.nodeType === Node.TEXT_NODE &&
            (domNode.textContent.includes('<iframe') || domNode.textContent.includes('generic-widget'))) {
            await processTextNode(domNode);
        }
        if (domNode instanceof HTMLIFrameElement
            && domNode.classList !== undefined
            && domNode.classList.contains('es-embed-iframe')) {
            if (domNode.getAttribute('data-repo-id') === getRepoId(editor)) {
                await processIframe(domNode);
            }
        }
        if (domNode instanceof Element && domNode.tagName.toLowerCase() === 'edu-sharing-generic-widget') {
            await processWidget(domNode);
        }
    };

    // Snapshot the state we are about to mutate. An unexpected failure aborts the whole
    // submit, so the editor has to be left exactly as the user had it - otherwise a retry
    // would treat already converted elements as new and create duplicate usages.
    const originalContent = editor.getContent();
    const originalInitialElements = [...initialElements];
    try {
        const container = window.document.createElement('div');
        container.innerHTML = originalContent;
        await iterateAsync(container);
        editor.setContent(container.innerHTML);
        for (const resourceId of initialElements) {
            await deleteEduSharingInstance({
                eduDeleteStructure: {
                    id: resourceId,
                    courseId: courseId
                }
            });
        }
    } catch (error) {
        editor.setContent(originalContent);
        initialElementsMap.set(editor, originalInitialElements);
        throw error;
    }
    const hasUsageFailures = failedInsertions.length > 0 || failedUpdates.length > 0;
    if (showIframeRemovalDialog || removedWidgets.length > 0 || hasUsageFailures) {
        let body = '';
        if (showIframeRemovalDialog) {
            body += '<p>' + await getString('iframeRemovalInfo', component) + '</p>';
        }
        if (removedWidgets.length > 0) {
            const widgetMessage = await getString('widgetRemovalInfo', component);
            body += '<p>' + widgetMessage.replace('##placeholder##', removedWidgets.join(', ')) + '</p>';
        }
        if (failedInsertions.length > 0) {
            body += renderFailureList(await getString('usageFailureInfo', component), failedInsertions);
        }
        if (failedUpdates.length > 0) {
            body += renderFailureList(await getString('usageUpdateFailureInfo', component), failedUpdates);
        }
        const title = await getString(hasUsageFailures ? 'usageFailureTitle' : 'removalTitle', component);
        await showFailureModal(title, body);
    }
    initialElementsMap.set(editor, []);
};

/**
 * Asynchronously retrieves and processes replacement content for an ES embedding iframe, based on its attributes
 * and additional data fetched or computed during the process.
 *
 * @param {object} editor - The editor instance responsible for managing content operations.
 * @param {HTMLElement} domNode - The DOM node representing the iframe for which content replacement is executed.
 * @param {Array<{title: string, reason: string}>} [failures] - Collects the reason when the conversion fails,
 * so the user can be told why the iframe was dropped.
 * @param {Array<{id: number, courseId: number}>} [createdInstances] - Collects the usages created here, so an
 * aborted submit can roll them back.
 * @returns {Promise<string>} A promise that resolves to the HTML content for replacing the iframe,
 * or an empty string if processing fails or required data is unavailable.
 */
const getIframeReplacementContent = async(editor, domNode, failures = [], createdInstances = []) => {
    const iframeSrc = domNode.getAttribute('src');
    try {
        const url = new URL(iframeSrc);
        const urlSearchParams = url.searchParams;
        const nodeId = urlSearchParams.get('node_id');
        const version = urlSearchParams.get('version') ?? '0';
        const mimeType = urlSearchParams.get('mimetype');
        const title = domNode.getAttribute('title');
        const mediaType = domNode.getAttribute('data-mediatype');
        const width = domNode.getAttribute('width');
        const height = domNode.getAttribute('height');
        const ccrepUrl =
            'ccrep://' +
            encodeURIComponent(getRepoId(editor)) +
            '/' +
            encodeURIComponent(nodeId);
        if (nodeId) {
            const ajaxParams = {
                eduStructure: {
                    name: title,
                    objectUrl: ccrepUrl,
                    courseId: parseInt(getCourseId(editor)),
                    objectVersion: version
                }
            };
            const response = await addEduSharingInstance(ajaxParams);
            if (response.id !== undefined) {
                createdInstances.push({id: response.id, courseId: parseInt(getCourseId(editor))});
                let previewUrl = `${Config.wwwroot}/mod/edusharing/preview.php`
                    + '?resourceId=' + response.id + '&nodeId=' + nodeId + '&mimetype=' + mimeType
                    + '&mediatype=' + mediaType + '&width=' + width + '&height=' + height;
                const renderedTemplate = await renderForPromise(`${component}/content`, {
                    edusharingImg: mediaType !== 'ref',
                    edusharingRef: mediaType === 'ref',
                    edusharingPreviewSrc: previewUrl,
                    edusharingTitle: title.toString(),
                    edusharingInsertCaption: false,
                    edusharingCaption: '',
                    edusharingWidth: width.toString(),
                    edusharingHeight: height.toString(),
                    edusharingStyle: '',
                    dataEdited: false
                });
                return renderedTemplate.html;
            }
        }
        return '';
    } catch (e) {
        window.console.error(e);
        failures.push({
            title: domNode.getAttribute('title') ?? '',
            reason: await describeFailure(e)
        });
        return '';
    }
};

export const initExistingElements = editor => {
    const iterate = domNode => {
        if (domNode.hasChildNodes()) {
            for (const node of domNode.childNodes) {
                iterate(node);
            }
        }
        if (domNode.classList !== undefined && domNode.classList.contains('edusharing_atto')) {
            let link = domNode.getAttribute(domNode.nodeName.toLowerCase() === 'img' ? 'src' : 'href');
            let uri = new URL(link);
            const arr = initialElementsMap.get(editor) || [];
            arr.push(parseInt(uri.searchParams.get('resourceId')));
            initialElementsMap.set(editor, arr);
        }
    };
    const container = window.document.createElement('div');
    container.innerHTML = editor.getContent();
    iterate(container);
};

/**
 * Extract a widget payload from a DOM node:
 * - tag: the element tag name (lowercased)
 * - attrs: all attributes as key/value pairs
 * Children/content are intentionally ignored.
 *
 * @param {Element} domNode
 * @returns {string}
 */
export const toWidgetPayload = (domNode) => {
    if (!domNode || domNode.nodeType !== Node.ELEMENT_NODE) {
        throw new TypeError('toWidgetPayload: domNode must be an Element');
    }

    const tag = domNode.tagName.toLowerCase();
    /** @type {Record<string, string|boolean>} */
    const attrs = {};

    for (const attr of Array.from(domNode.attributes)) {
        if (widgetAttributeWhitelist.includes(attr.name)) {
            attrs[attr.name] = attr.value === '' ? true : attr.value;
        }
    }
    if (!supportedWidgetTypes.includes(attrs['widget-type'])) {
        throw new Error(`unsupported:${attrs['widget-type']}`);
    }
    return JSON.stringify({tag, attrs});
};
