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

import {getCourseId} from "./options";
import {addEduSharingInstance, deleteEduSharingInstance, updateInstance} from "./repository";
import Config from 'core/config';

export const initEventHandler = (editor) => {
    const container = editor.getContainer();
    const form = container.closest("form");
    if (form !== null && typeof form.submit === "function") {
        form.addEventListener('submit', async(event) => {
            if (event.submitter.id === "id_submitbutton" || event.submitter.id === "id_submitbutton2") {
                event.preventDefault();
                await convertForSubmit(editor);
                form.submit();
            }
        });
    }
};

/**
 * The variable initialElements contains all existing es objects found when the editor is instantiated.
 * This is needed for bookkeeping.
 */
let initialElements = [];

const convertForSubmit = async(editor) => {
    const iterateAsync = async domNode => {
        if (domNode.hasChildNodes()) {
            for (const node of domNode.childNodes) {
                await iterateAsync(node);
            }
        }
        if (domNode.classList !== undefined && domNode.classList.contains('edusharing_atto')) {
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
            initialElements.push(parseInt(uri.searchParams.get('resourceId')));
        }
    };
    const container = window.document.createElement('div');
    container.innerHTML = editor.getContent();
    iterate(container);
};
