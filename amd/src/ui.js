// This file is part of Moodle - http://moodle.org/
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
// along with Moodle.  If not, see <http://www.gnu.org/licenses/>.

/**
 * Script ui.js
 *
 * Contains all logic for the modal
 * - Insert form (opening repo, settings for object, inserting into editor)
 * - Edit form (changing settings, detecting, handling and converting old atto objects)
 *
 * On edit, old atto es objects will be converted to the format used by tinyMCE in order to ensure backwards
 * compatibility. Subsequently, they can no longer be edited using atto.
 *
 * @module      tiny_edusharing/ui
 * @copyright   2024 metaVentis GmbH <http://metaventis.com>
 * @license     http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

import {component} from './common';
import {getCourseId, getRepoTarget, getRepoUrl, getEnableRepoTargetChooser} from './options';
import {
    clampCustomHeight,
    isCustomHeightMimeType,
    usesCustomHeight,
    validateOrigin,
    CUSTOM_HEIGHT_DEFAULT,
    CUSTOM_HEIGHT_MAX,
    CUSTOM_HEIGHT_MIN
} from 'mod_edusharing/utils';
import {renderForPromise} from 'core/templates';
import Modal from 'tiny_edusharing/modal';
import ModalEvents from 'core/modal_events';
import ModalFactory from 'core/modal_factory';
import {getTicket} from "./repository";
import Config from 'core/config';

let openingSelection = null;

export const handleAction = (editor) => {
    openingSelection = editor.selection.getBookmark();
    displayDialogue(editor);
};

export const initInstructionGif = () => {
    const gif = window.document.getElementById('eduInstructionGif');
    if (gif === null) {
        return;
    }
    const relativePath = gif.getAttribute('src');
    const absolutePath = Config.wwwroot + relativePath;
    gif.setAttribute('src', absolutePath);
};

const handleInsertSubmission = async(editor) => {
    const nodeJson = window.document.getElementById('edusharing_node').value;
    const node = JSON.parse(nodeJson);
    const version = window.document.querySelector('input[name="eduVersion"]:checked').value;
    const caption = window.document.getElementById('captionInput').value;
    const alignment = window.document.querySelector('input[name="eduAlignment"]:checked').value;
    // Height only objects are rendered at the full available width, so the width and height
    // attributes are only there to keep the editor preview in shape - just like for the
    // object types that offer no size choice at all.
    const isHeightOnly = window.document.getElementById('edusharingHeightOnly').value === "true";
    let width;
    let height;
    let renderHeight = null;
    if (isHeightOnly || window.document.getElementById('edusharingNoWidth').value === "true") {
        const previewHeight = window.document.getElementById('eduPreviewImage').height;
        const previewWidth = window.document.getElementById('eduPreviewImage').width;
        const ratio = previewWidth / previewHeight;
        width = 400;
        height = 400 / ratio;
    } else {
        width = window.document.getElementById('eduWidth').value;
        height = checkIfHeightApplicable(node.mediatype) ?
            window.document.getElementById('eduHeight').value : "auto";
    }
    if (isHeightOnly) {
        renderHeight = clampCustomHeight(window.document.getElementById('eduHeight').value);
    }
    let style = '';
    if (alignment !== 'none') {
        style = 'float:' + alignment + ';';
    }
    if (node.mediatype === 'folder') {
        style = 'display:block;';
    }

    let title = node.title || node.name;
    const courseId = getCourseId(editor);
    const ajaxParams = {
        eduTicketStructure: {
            courseId: courseId
        }
    };
    const ticket = await getTicket(ajaxParams).catch(error => {
        window.console.error(error);
        return '';
    });

    let url = new URL(node.previewUrl);
    url.searchParams.set('caption', caption);
    url.searchParams.set('object_url', node.objectUrl);
    url.searchParams.set('mediatype', node.mediatype);
    url.searchParams.set('mimetype', node.mimetype);
    url.searchParams.set('window_version', version);
    url.searchParams.set('title', title);
    if (ticket !== '') {
        url.searchParams.set('ticket', ticket.ticket);
    }
    let img = false;
    let ref = false;

    if (node.mediatype === 'ref') {
        ref = true;
    } else {
        img = true;
        url.searchParams.set('width', width.toString());
        url.searchParams.set('height', height.toString());
    }
    if (renderHeight !== null) {
        // The height goes into the preview url, not into a data attribute: the filter runs
        // after the text has been cleaned and HTMLPurifier drops data attributes.
        url.searchParams.set('render_height', renderHeight.toString());
    }

    const content = await renderForPromise(`${component}/content`, {
        edusharingImg: img,
        edusharingRef: ref,
        edusharingPreviewSrc: sanitizePreviewUrl(url.toString()),
        edusharingTitle: title.toString(),
        edusharingInsertCaption: caption.toString() !== "",
        edusharingCaption: caption.toString(),
        edusharingWidth: width.toString(),
        edusharingHeight: height.toString(),
        edusharingStyle: style,
        dataEdited: false
    });

    editor.selection.moveToBookmark(openingSelection);
    editor.execCommand('mceInsertContent', false, content.html);
    editor.selection.moveToBookmark(openingSelection);
};

/**
 * Returns a safe URL for use in href/src attributes.
 * Only http(s) URLs are allowed; everything else falls back to '#'.
 *
 * @param {string} rawUrl
 * @returns {string}
 */
const sanitizePreviewUrl = (rawUrl) => {
    try {
        const parsed = new URL(rawUrl, window.location.origin);
        if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
            return parsed.toString();
        }
    } catch (e) {
        // Ignore invalid URLs.
    }
    return '#';
};

const displayDialogue = async(editor) => {
    const prepareEditModal = () => {
        const addEditSubmitHandler = () => {
            $root.on(ModalEvents.save, () => {
                const newCaption = window.document.getElementById('captionInput').value;
                const inputAlignment = window.document.querySelector('input[name="eduAlignment"]:checked').value;
                const hasAlignmentChanged = inputAlignment !== alignment;
                const inputWidth = parseInt(window.document.getElementById('eduWidth').value);
                const inputHeight = parseInt(window.document.getElementById('eduHeight').value);
                let hasSizeChanged = isHeightOnly ? false : (inputHeight !== height || inputWidth !== width);
                const newRenderHeight = isHeightOnly
                    ? clampCustomHeight(window.document.getElementById('eduHeight').value) : null;
                // An object that predates the height choice has no stored height yet - saving
                // the dialogue is what opts it in, at the height the dialogue offered.
                const hasRenderHeightChanged = isHeightOnly
                    && (storedRenderHeight === null || newRenderHeight !== renderHeight);
                if (isSizeEditable && hasSizeChanged) {
                    url.searchParams.set('width', inputWidth);
                    url.searchParams.set('height', inputHeight);
                }
                if (isHeightOnly) {
                    url.searchParams.set('render_height', newRenderHeight);
                }
                if (!isOldAttoElement) {
                    if (existingCaption === null && newCaption !== "") {
                        const newCaptionParagraph = document.createElement('p');
                        newCaptionParagraph.classList.add('edusharing_caption');
                        newCaptionParagraph.textContent = newCaption;
                        currentEdusharing.appendChild(newCaptionParagraph);
                    } else if (existingCaption !== null && newCaption !== "") {
                        existingCaptionParagraph.remove();
                    } else if (existingCaption !== null) {
                        existingCaption.textContent = newCaption;
                    }
                    if (hasAlignmentChanged) {
                        if (inputAlignment === 'none') {
                            currentEdusharing.style.removeProperty('float');
                            currentEdusharing.setAttribute('data-mce-style', "");
                        } else {
                            currentEdusharing.style.float = inputAlignment;
                            currentEdusharing.setAttribute('data-mce-style', 'float: ' + inputAlignment + ';');
                        }
                    }
                    if (isSizeEditable && hasSizeChanged) {
                        eduImage.setAttribute('width', inputWidth);
                        eduImage.setAttribute('height', inputHeight);
                    }
                    if (hasAlignmentChanged || hasSizeChanged || hasRenderHeightChanged) {
                        eduImage.setAttribute('src', url.toString());
                        eduImage.setAttribute('data-edited', 1);
                    }
                } else {
                    let style = '';
                    if (inputAlignment !== 'none') {
                        style = 'float:' + inputAlignment + ';';
                    }
                    if (url.searchParams.get('mediatype') === 'folder') {
                        style = 'display:block;';
                    }
                    renderForPromise(`${component}/content`, {
                        edusharingImg: true,
                        edusharingRef: false,
                        edusharingPreviewSrc: sanitizePreviewUrl(url.toString()),
                        edusharingTitle: url.searchParams.get('title'),
                        edusharingInsertCaption: window.document.getElementById('captionInput').value !== "",
                        edusharingCaption: window.document.getElementById('captionInput').value,
                        edusharingWidth: (isHeightOnly ? width : inputWidth).toString(),
                        edusharingHeight: (isHeightOnly ? height : inputHeight).toString(),
                        edusharingStyle: style,
                        dataEdited: hasAlignmentChanged || hasSizeChanged || hasRenderHeightChanged
                    }).then(result => {
                        currentEdusharing.remove();
                        if (paragraphToRemove !== null) {
                            paragraphToRemove.remove();
                            const nextParagraph = paragraphToRemove.nextSibling;
                            if (nextParagraph !== null && nextParagraph.nodeName === 'P'
                                && nextParagraph.hasChildNodes() && nextParagraph.firstChild.nodeName === 'BR'
                                && nextParagraph.innerText === "") {
                                nextParagraph.remove();
                            }
                        }
                        editor.selection.moveToBookmark(openingSelection);
                        editor.insertContent(result.html);
                        editor.selection.moveToBookmark(openingSelection);
                        return false;
                    }).catch(error => window.console.log(error));
                }
            });
        };
        let existingCaption = null;
        const nodeOptionsForm = window.document.getElementById('nodeOptionsForm');
        const existingCaptionParagraph = currentEdusharing.querySelector('.edusharing_caption');
        let paragraphToRemove = null;
        if (isOldAttoElement) {
            const nextSibling = currentEdusharing.nextSibling;
            if (nextSibling !== null && nextSibling.nodeName === 'P' && nextSibling.innerText.trim() !== "") {
                window.document.getElementById('eduCaptionText').textContent = nextSibling.innerText;
                window.document.getElementById('eduAttoCaptionPrompt').classList.remove('d-none');
                window.document.getElementById('eduCaptionContinueButton').classList.remove('d-none');
                window.document.getElementById('eduSubmitButton').classList.add('d-none');
                nodeOptionsForm.classList.add('d-none');
                window.document.getElementById('eduCaptionContinueButton').addEventListener("click", () => {
                    const useExistingCaption = window.document.querySelector('input[name="eduCaption"]:checked').value === '0';
                    paragraphToRemove = useExistingCaption ? nextSibling : null;
                    if (useExistingCaption) {
                        window.document.getElementById('captionInput').value = nextSibling.innerText;
                        existingCaption = nextSibling.innerText;
                    }
                    nodeOptionsForm.classList.remove('d-none');
                    window.document.getElementById('eduAttoCaptionPrompt').classList.add('d-none');
                    window.document.getElementById('eduCaptionContinueButton').classList.add('d-none');
                    window.document.getElementById('eduSubmitButton').classList.remove('d-none');
                });
            } else {
                nodeOptionsForm.classList.remove('d-none');
            }
        } else {
            if (existingCaptionParagraph !== null) {
                window.document.getElementById('captionInput').value = existingCaptionParagraph.innerHTML;
                existingCaption = existingCaptionParagraph.innerHTML;
            }
            nodeOptionsForm.classList.remove('d-none');
        }
        const submitButton = window.document.getElementById('eduSubmitButton');
        submitButton.disabled = false;
        submitButton.innerHTML = submitButton.getAttribute('data-secondary-title');
        let isSizeEditable = true;
        let isHeightOnly = false;
        const modalTitle = root.querySelector('.modal-title');
        modalTitle.textContent = modalTitle.querySelector('input').value;
        window.document.getElementById('repoButtonContainer').classList.add('d-none');
        const eduImage = currentEdusharing.querySelector("img.edusharing_atto");
        if (eduImage === null || eduImage === undefined) {
            root.querySelector('.mform').classList.add('d-none');
            root.getElementById('eduNoEditInfo').classList.remove('d-none');
            root.getElementById('eduSubmitButton').classList.add('d-none');
            return;
        }
        const objectUrl = eduImage.getAttribute('src');
        window.document.getElementById('eduPreviewImage').setAttribute('src', objectUrl);
        let url = new URL(objectUrl);
        const mediaType = url.searchParams.get('mediatype');
        let width = 400;
        let height = 600;
        // The parameter is written for every height only object, so its mere presence marks one.
        // Objects inserted before the height choice existed are recognised by their mimetype -
        // serlo and lti tool objects among them keep the size handling they were inserted with.
        const storedRenderHeight = url.searchParams.get('render_height');
        isHeightOnly = storedRenderHeight !== null || isCustomHeightMimeType(url.searchParams.get('mimetype'));
        let renderHeight = null;
        if (isHeightOnly) {
            width = parseInt(eduImage.getAttribute('width') ?? 400) || 400;
            height = parseInt(eduImage.getAttribute('height') ?? 600) || 600;
            renderHeight = clampCustomHeight(storedRenderHeight);
            showHeightOnlyInput(renderHeight);
            isSizeEditable = false;
        } else if (!hideSizeOptions(mediaType)) {
            width = parseInt(eduImage.getAttribute('width') ?? 400);
            height = parseInt(eduImage.getAttribute('height') ?? 600);
            initSizeCalculation(width, height);
            hideHeightInput(mediaType);
        } else {
            isSizeEditable = false;
        }
        window.document.getElementById("objectVersioningContainer").classList.add('d-none');
        window.document.getElementById('eduContentTitle').textContent = url.searchParams.get('title');
        let alignment = currentEdusharing.style.float === "" ? 'none' : currentEdusharing.style.float;
        if (alignment === "none" && isOldAttoElement) {
            alignment = currentEdusharing.style.textAlign === "" ? 'none' : currentEdusharing.style.textAlign;
        }
        if (alignment !== 'none') {
            window.document.getElementById('eduAlignment' + (alignment === 'right' ? '2' : '1')).checked = true;
        }
        addEditSubmitHandler();
    };
    const prepareInsertModal = () => {
        const enableRepoTargetChooser = getEnableRepoTargetChooser(editor);
        const repoUrl = getRepoUrl(editor);
        if (enableRepoTargetChooser) {
            const chooserEnabledDomElements = window.document.querySelectorAll('.eduRepoTargetChooserEnabled');
            for (const chooserEnabledDomElement of chooserEnabledDomElements) {
                chooserEnabledDomElement.classList.remove('d-none');
            }
            const buttonGroupContainer = window.document.getElementById('eduRepoButtonChooser');
            for (const child of buttonGroupContainer.children) {
                child.addEventListener('click', () => {
                    openRepo(repoUrl, child.getAttribute('data-target'), getCourseId(editor));
                    window.addEventListener("message", applyNodeListener);
                });
            }
        } else {
            const chooserDisabledDomElements = window.document.querySelectorAll('.eduRepoTargetChooserDisabled');
            for (const chooserDisabledDomElement of chooserDisabledDomElements) {
                chooserDisabledDomElement.classList.remove('d-none');
            }
            const repoButton = window.document.getElementById('eduRepoButton');
            repoButton.addEventListener('click', () => {
                openRepo(repoUrl, getRepoTarget(editor), getCourseId(editor));
                window.addEventListener("message", applyNodeListener);
            });
        }
        const applyNodeListener = event => {
            if (event.data.event === "APPLY_NODE" && validateOrigin(event.origin, repoUrl)) {
                window.console.log(event);
                const prepareModal = () => {
                    if (node.mediatype !== 'ref' && usesCustomHeight(node)) {
                        window.document.getElementById('edusharingHeightOnly').value = "true";
                        showHeightOnlyInput(CUSTOM_HEIGHT_DEFAULT);
                    } else if (hideSizeOptions(node.mediatype)) {
                        window.document.getElementById('edusharingNoWidth').value = "true";
                    } else {
                        const width = node.properties['ccm:width'] !== undefined
                            ? Math.round(node.properties['ccm:width'][0]) : 400;
                        const height = node.properties['ccm:height'] !== undefined
                            ? Math.round(node.properties['ccm:height'][0]) : 600;
                        initSizeCalculation(width, height);
                        hideHeightInput(node.mediatype);
                    }
                    hideCaptionInput(node.mediatype);
                    setNodeData(node);
                    window.document.getElementById('eduSubmitButton').disabled = false;
                };
                const node = event.data.data;
                const previewImage = window.document.getElementById('eduPreviewImage');
                window.win.close();
                checkVersioning(node);
                window.document.getElementById('repoButtonContainer').classList.add('d-none');
                window.document.getElementById('nodeOptionsForm').classList.remove('d-none');
                window.document.getElementById('eduContentTitle').textContent = node.name ?? node.title;
                const courseId = getCourseId(editor);
                const ajaxParams = {
                    eduTicketStructure: {
                        courseId: courseId
                    }
                };
                getTicket(ajaxParams)
                    .then(response => {
                        const previewUrl = new URL(node.preview.url);
                        const queryData = new URLSearchParams(previewUrl.search.slice(1));
                        queryData.set("ticket", response.ticket);
                        const newUrl = new URL(node.preview.url);
                        newUrl.search = queryData.toString();
                        previewImage.setAttribute('src', newUrl.toString());
                        prepareModal();
                        return null;
                    })
                    .fail(() => {
                        previewImage.setAttribute('src', node.preview.url);
                        prepareModal();
                    });
            }
        };
    };
    const selection = editor.selection.getNode();
    let currentEdusharing = selection.closest('.edusharing-placeholder');
    let isOldAttoElement = false;
    if (currentEdusharing === null) {
        if (selection.nodeName === 'IMG' && selection.classList.contains('edusharing_atto')) {
            const parent = selection.parentNode;
            if (parent.nodeName === 'P') {
                currentEdusharing = parent;
                isOldAttoElement = true;
            }
        } else if (selection.nodeName === 'P') {
            const firstChild = selection.firstChild;
            if (firstChild.nodeName === 'IMG' && firstChild.classList.contains('edusharing_atto')) {
                currentEdusharing = selection;
                isOldAttoElement = true;
            }
        }
    }
    const isEditMode = currentEdusharing !== null;
    const modal = await ModalFactory.create({
        type: Modal.TYPE,
        large: true,
        removeOnClose: true
    });
    modal.show();
    const $root = modal.getRoot();
    const root = $root[0];
    if (isEditMode) {
        prepareEditModal();
    } else {
        prepareInsertModal();
        $root.on(ModalEvents.save, () => {
            handleInsertSubmission(editor);
        });
    }
    initInstructionGif();
};

const hideSizeOptions = mediaType => {
    const mediaTypesWithoutSizeChoice = ['file-word', 'file-pdf', 'file-odt', 'file-audio', 'file-pdf', 'link'];
    if (mediaTypesWithoutSizeChoice.includes(mediaType)) {
        window.document.getElementById('eduWidthContainer').classList.add('d-none');
        return true;
    }
    return false;
};

/**
 * Offers the height as the only size option.
 *
 * Objects rendered at the full available width - pdf-like documents, serlo and lti tool
 * objects - have
 * no width to choose, and their height is not tied to an aspect ratio either.
 *
 * @param {number} height
 */
const showHeightOnlyInput = height => {
    window.document.getElementById('eduWidthContainer').classList.remove('d-none');
    window.document.getElementById('eduHeightOnlyHint').classList.remove('d-none');
    const widthInput = window.document.getElementById('eduWidth');
    widthInput.classList.add('d-none');
    if (widthInput.labels) {
        widthInput.labels.forEach(label => label.classList.add('d-none'));
    }
    const heightInput = window.document.getElementById('eduHeight');
    heightInput.classList.remove('d-none');
    if (heightInput.labels) {
        heightInput.labels.forEach(label => label.classList.remove('d-none'));
    }
    heightInput.setAttribute('min', CUSTOM_HEIGHT_MIN.toString());
    heightInput.setAttribute('max', CUSTOM_HEIGHT_MAX.toString());
    heightInput.value = height;
};

const hideHeightInput = mediaType => {
    if (!checkIfHeightApplicable(mediaType)) {
        const heightInput = window.document.getElementById('eduHeight');
        heightInput.classList.add('d-none');
        if (heightInput.labels) {
            heightInput.labels.forEach(label => label.classList.add('d-none'));
        }
    }
};

const checkIfHeightApplicable = mediaType => mediaType !== "file-video";

const hideCaptionInput = mediaType => {
    if (mediaType === "ref") {
        window.document.getElementById("eduCaptionContainer").classList.add('d-none');
    }
};

const initSizeCalculation = (width, height) => {
    if (width === 0 || height === 0) {
        return;
    }
    const aspectRatio = width / height;
    const heightInput = window.document.getElementById('eduHeight');
    const widthInput = window.document.getElementById('eduWidth');
    widthInput.value = width;
    heightInput.value = height;
    widthInput.addEventListener('keyup', event => recalculateDimensions(event));
    widthInput.addEventListener('change', event => recalculateDimensions(event));
    heightInput.addEventListener('keyup', event => recalculateDimensions(event));
    heightInput.addEventListener('change', event => recalculateDimensions(event));
    const recalculateDimensions = (event) => {
        if (event.target.id === 'eduHeight') {
            widthInput.value = Math.round(heightInput.value * aspectRatio);
        } else {
            heightInput.value = Math.round(widthInput.value / aspectRatio);
        }
    };
};

const checkVersioning = (node) => {
    const hasVersion = node.properties['cclom:version'] !== undefined;
    if (node.aspects.includes('ccm:published') || node.aspects.includes('ccm:collection_io_reference') || !hasVersion) {
        window.document.querySelectorAll(".eduVersionRadio")
            .forEach(item => item.classList.add('d-none'));
    }
    if (hasVersion) {
        window.document.getElementById('eduVersion2').value = node.properties['cclom:version'][0];
    }
};

const setNodeData = node => {
    const nodeData = {
        mimetype: node.mimetype,
        mediatype: node.mediatype,
        title: node.title,
        objectUrl: node.objectUrl,
        name: node.name,
        previewUrl: node.preview.url
    };
    window.document.getElementById('edusharing_node').value = JSON.stringify(nodeData);
};

const openRepo = (repoUrl, repoTarget, courseId) => {
    window.win = window.open();
    window.win.document.write('Loading edu-sharing ticket...');
    switch (repoTarget) {
        case 'collections':
            repoTarget = '/components/collections';
            break;
        case 'workspace':
            repoTarget = '/components/workspace/files';
            break;
        default:
            repoTarget = '/components/search';
    }
    const ajaxParams = {
        eduTicketStructure: {
            courseId: courseId
        }
    };
    getTicket(ajaxParams)
        .then(response => {
            repoUrl += repoTarget + '?reurl=WINDOW&applyDirectories=false&ticket=' + response.ticket;
            window.win.location.href = repoUrl;
            return null;
        })
        .fail(() => window.document.write('Error loading ticket.'));
};
