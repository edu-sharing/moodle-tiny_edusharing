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
 * It also contains the logic for keeping score of es elements already present in the section opened.
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

                const formEditors = formEditorsMap.get(form) || new Set();
                try {
                    await Promise.all([...formEditors].map(editor => convertForSubmit(editor)));
                } finally {
                    form.dataset.esBypassSubmit = "1";
                    if (submitter.id === "id_submitbutton") {
                        const hidden = document.createElement('input');
                        hidden.type = 'hidden';
                        hidden.name = 'submitbutton';
                        hidden.value = '1';
                        form.appendChild(hidden);
                    }
                    form.submit();
                }
            });
        }
    }
};

const convertForSubmit = async(editor) => {
    const initialElements = initialElementsMap.get(editor) || [];
    let showIframeRemovalDialog = false;
    let removedWidgets = [];
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
            let uri = new URL(link);
            let searchParams = uri.searchParams;
            let indexOfElement = initialElements.indexOf(parseInt(searchParams.get('resourceId')));
            if (indexOfElement >= 0) {
                initialElements.splice(indexOfElement, 1);
                if (domNode.getAttribute('data-edited') !== null && domNode.getAttribute('data-edited') !== "") {
                    let ajaxParams = {
                        eduStructure: {
                            id: parseInt(searchParams.get('resourceId')),
                            courseId: parseInt(getCourseId(editor)),
                            objectUrl: searchParams.get('object_url')
                        }
                    };
                    let response = await updateInstance(ajaxParams);
                    if (response.id === undefined) {
                        window.console.log('Error updating instance');
                    }
                    domNode.removeAttribute('data-edited');
                }
            } else {
                let ajaxParams = {
                    eduStructure: {
                        name: searchParams.get('title'),
                        objectUrl: searchParams.get('object_url'),
                        courseId: parseInt(getCourseId(editor)),
                        objectVersion: searchParams.get('window_version')
                    }
                };
                let response = await addEduSharingInstance(ajaxParams);
                if (response.id !== undefined) {
                    let isImage = domNode.nodeName.toLowerCase() === 'img';
                    let previewUrl = `${Config.wwwroot}/mod/edusharing/preview.php`
                        + '?resourceId=' + response.id + '&' + searchParams.toString();
                    domNode.setAttribute(isImage ? 'src' : 'href', previewUrl);
                }
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
            tempDiv.innerHTML = domNode.textContent;
            const iframes = tempDiv.querySelectorAll('iframe.es-embed-iframe');
            for (const iframe of iframes) {
                if (iframe.getAttribute('data-repo-id') === getRepoId(editor)) {
                    const replacement = await getIframeReplacementContent(editor, iframe);
                    if (replacement !== '') {
                        iframe.outerHTML = replacement;
                    } else {
                        iframe.remove();
                        showIframeRemovalDialog = true;
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
            const replacement = await getIframeReplacementContent(editor, domNode);
            if (replacement !== '') {
                domNode.outerHTML = replacement;
            } else {
                domNode.remove();
                showIframeRemovalDialog = true;
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
            for (const node of domNode.childNodes) {
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

    const container = window.document.createElement('div');
    container.innerHTML = editor.getContent();
    await iterateAsync(container);
    editor.setContent(container.innerHTML);
    for (const resourceId of initialElements) {
        await deleteEduSharingInstance({
            eduDeleteStructure: {
                id: resourceId,
                courseId: parseInt(getCourseId(editor))
            }
        });
    }
    if (showIframeRemovalDialog || removedWidgets.length > 0) {
        const translatedTitle = await new Promise((resolve) => {
            getString('removalTitle', 'tiny_edusharing').done(resolve);
        });
        let translatedIframeMessage = "";
        if (showIframeRemovalDialog) {
            translatedIframeMessage = await new Promise((resolve) => {
                getString('iframeRemovalInfo', 'tiny_edusharing').done(resolve);
            });
            translatedIframeMessage = '<p>' + translatedIframeMessage + '</p>';
        }
        let translatedModalMessage = "";
        if (removedWidgets.length > 0) {
            translatedModalMessage = await new Promise((resolve) => {
                getString('widgetRemovalInfo', 'tiny_edusharing').done(resolve);
            });
            translatedModalMessage = '<p>' + translatedModalMessage.replace('##placeholder##', removedWidgets.join(', ')) + '</p>';
        }
        const body = (showIframeRemovalDialog ? translatedIframeMessage : '')
            + (removedWidgets.length > 0 ? translatedModalMessage : '');
        const modal = await Modal.create({
            title: translatedTitle,
            body: body,
            footer: '<button type="button" class="btn btn-primary" data-action="confirm">OK</button>',
            show: true,
            removeOnClose: true
        });
        await new Promise((resolve) => {
            modal.getRoot().on('click', '[data-action="confirm"]', resolve);
            modal.getRoot().on('hidden.bs.modal', resolve);
        });
    }
    initialElementsMap.set(editor, []);
};

/**
 * Asynchronously retrieves and processes replacement content for an ES embedding iframe, based on its attributes
 * and additional data fetched or computed during the process.
 *
 * @param {object} editor - The editor instance responsible for managing content operations.
 * @param {HTMLElement} domNode - The DOM node representing the iframe for which content replacement is executed.
 * @returns {Promise<string>} A promise that resolves to the HTML content for replacing the iframe,
 * or an empty string if processing fails or required data is unavailable.
 * @throws {Error} If an unexpected issue occurs during processing, resulting in a rejection with an empty string.
 */
const getIframeReplacementContent = async(editor, domNode) => {
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
        attrs[attr.name] = attr.value === '' ? true : attr.value;
    }
    if (attrs['widget-type'] !== 'wlo-content-teaser') {
        throw new Error(`unsupported:${attrs['widget-type']}`);
    }
    return JSON.stringify({tag, attrs});
};
