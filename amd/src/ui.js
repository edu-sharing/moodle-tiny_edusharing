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
 * Tiny edu-sharing Content configuration.
 *
 * @module      tiny_edusharing/commands
 * @copyright   2022 metaVentis GmbH <http://metaventis.com>
 * @license     http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

import {component} from './common';
import {getCourseId, getRepoTarget, getRepoUrl} from './options';

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
    const width = window.document.getElementById('eduWidth').value;
    const height = window.document.getElementById('eduHeight').value;
    let style = '';
    if (alignment !== 'none') {
        style = 'float:' + alignment + ';';
    }
    if (node.mediatype === 'folder') {
        style = 'display:block;';
    }

    let title = node.title || node.name;

    let url = new URL(node.previewUrl);
    url.searchParams.set('caption', caption);
    url.searchParams.set('object_url', node.objectUrl);
    url.searchParams.set('mediatype', node.mediatype);
    url.searchParams.set('mimetype', node.mimetype);
    url.searchParams.set('window_version', version);
    url.searchParams.set('title', title);

    let img = false;
    let ref = false;

    if (node.mediatype === 'ref') {
        ref = true;
    } else {
        img = true;
        url.searchParams.set('width', width.toString());
        url.searchParams.set('height', height.toString());
    }

    const content = await renderForPromise(`${component}/content`, {
        edusharingImg: img,
        edusharingRef: ref,
        edusharingPreviewSrc: url.toString(),
        edusharingTitle: title.toString(),
        edusharingCaption: caption.toString(),
        edusharingWidth: width.toString(),
        edusharingHeight: height.toString(),
        edusharingStyle: style
    });

    editor.selection.moveToBookmark(openingSelection);
    editor.execCommand('mceInsertContent', false, content.html);
    editor.selection.moveToBookmark(openingSelection);
};

const displayDialogue = async(editor) => {
    const prepareEditModal = () => {
        const addEditSubmitHandler = () => {
            $root.on(ModalEvents.save, () => {
                const newCaption = window.document.getElementById('captionInput').value;
                if (existingCaptionParagraph === null && newCaption !== "") {
                    const newCaptionParagraph = document.createElement('p');
                    newCaptionParagraph.classList.add('edusharing_caption');
                    newCaptionParagraph.innerHTML(newCaption);
                    currentEdusharing.appendChild(newCaptionParagraph);
                } else if (existingCaptionParagraph !== null) {
                    existingCaptionParagraph.innerHTML = newCaption;
                }
                const inputAlignment = window.document.querySelector('input[name="eduAlignment"]:checked').value;
                const hasAlignmentChanged = inputAlignment !== alignment;
                if (hasAlignmentChanged) {
                    if (inputAlignment === 'none') {
                        currentEdusharing.style.removeProperty('float');
                        currentEdusharing.setAttribute('data-mce-style', "");
                    } else {
                        currentEdusharing.style.float = inputAlignment;
                        currentEdusharing.setAttribute('data-mce-style', 'float: ' + inputAlignment + ';');
                    }
                }
                let hasSizeChanged = false;
                if (isSizeEditable) {
                    const inputWidth = window.document.getElementById('eduWidth').value;
                    const inputHeight = window.document.getElementById('eduHeight').value;
                    hasSizeChanged = inputHeight !== height || inputWidth !== width;
                    if (hasSizeChanged) {
                        eduImage.setAttribute('width', inputWidth);
                        eduImage.setAttribute('height', inputHeight);
                        url.searchParams.set('width', inputWidth);
                        url.searchParams.set('height', inputHeight);
                    }
                }
                if (hasAlignmentChanged || hasSizeChanged) {
                    eduImage.setAttribute('src', url.toString());
                    eduImage.setAttribute('data-edited', 1);
                }
            });
        };
        const submitButton = window.document.getElementById('eduSubmitButton');
        submitButton.disabled = false;
        submitButton.innerHTML = submitButton.getAttribute('data-secondary-title');
        let isSizeEditable = true;
        const modalTitle = root.querySelector('.modal-title');
        modalTitle.innerHTML = modalTitle.querySelector('input').value;
        const nodeOptionsForm = window.document.getElementById('nodeOptionsForm');
        window.document.getElementById('repoButtonContainer').classList.add('d-none');
        nodeOptionsForm.classList.remove('d-none');
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
        let width = 600;
        let height = 400;
        if (!hideSizeOptions(mediaType)) {
            width = parseInt(eduImage.getAttribute('width') ?? 600);
            height = parseInt(eduImage.getAttribute('height') ?? 400);
            initSizeCalculation(width, height);
        } else {
            isSizeEditable = false;
        }
        window.document.querySelectorAll(".eduVersionRadio").forEach(item => item.classList.add('d-none'));

        const existingCaptionParagraph = currentEdusharing.querySelector('.edusharing_caption');
        const existingCaption = existingCaptionParagraph === null ? "" : existingCaptionParagraph.innerHTML;
        window.document.getElementById('captionInput').value = existingCaption;
        window.document.getElementById('eduContentTitle').innerHTML = url.searchParams.get('title');
        const alignment = currentEdusharing.style.float ?? 'none';
        if (alignment !== 'none') {
            window.document.getElementById('eduAlignment' + (alignment === 'right' ? '2' : '1')).checked = true;
        }
        addEditSubmitHandler();
    };
    const prepareInsertModal = () => {
        root.addEventListener('click', (e) => {
            const openRepoButton = e.target.closest('[data-target="edusharing"]');
            if (openRepoButton) {
                const repoUrl = getRepoUrl(editor);
                openRepo(repoUrl, getRepoTarget(editor), getCourseId(editor));
                window.addEventListener("message", applyNodeListener);
            }
        });
        const applyNodeListener = event => {
            if (event.data.event === "APPLY_NODE") {
                const node = event.data.data;
                const width = node.properties['ccm:width'] !== undefined ? Math.round(node.properties['ccm:width'][0]) : 600;
                const height = node.properties['ccm:height'] !== undefined ? Math.round(node.properties['ccm:height'][0]) : 400;
                window.win.close();
                checkVersioning(node);
                window.document.getElementById('repoButtonContainer').classList.add('d-none');
                window.document.getElementById('nodeOptionsForm').classList.remove('d-none');
                window.document.getElementById('eduContentTitle').innerHTML = node.name ?? node.title;
                window.document.getElementById('eduPreviewImage')
                    .setAttribute('src', node.preview.url);
                hideSizeOptions(node.mediatype);
                hideCaptionInput(node.mediatype);
                initSizeCalculation(width, height);
                setNodeData(node);
                window.document.getElementById('eduSubmitButton').disabled = false;
            }
        };
    };
    const selection = editor.selection.getNode();
    const currentEdusharing = selection.closest('.edusharing-placeholder');
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
};

const hideSizeOptions = mediaType => {
    const mediaTypesWithoutSizeChoice = ['file-word', 'file-pdf', 'file-odt', 'file-audio', 'file-pdf', 'link'];
    if (mediaTypesWithoutSizeChoice.includes(mediaType)) {
        window.document.getElementById('eduWidthContainer').classList.add('d-none');
        return true;
    }
    return false;
};

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
        window.document.getElementById('eduversion2').value = node.properties['cclom:version'][0];
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
            repoUrl += repoTarget + '?reurl=WINDOW&applyDirectories=true&ticket=' + response.ticket;
            window.win.location.href = repoUrl;
            return null;
        })
        .fail(() => window.document.write('Error loading ticket.'));
};
