import {getCourseId} from "./options";
import {addEduSharingInstance, deleteEduSharingInstance} from "./repository";
import Config from 'core/config';

export const initEventHandler = (editor) => {
    const container = editor.getContainer();
    const form = container.closest("form");
    form.addEventListener('submit', async(event) => {
        event.preventDefault();
        await convertForSubmit(editor);
        form.submit();
    });
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
            let indexOfElement = initialElements.indexOf(searchParams.get('resource_id'));
            if (indexOfElement > 0) {
                initialElements.splice(indexOfElement, 1);
            } else {
                const ajaxParams = {
                    eduStructure: {
                        name: searchParams.get('title'),
                        objectUrl: searchParams.get('object_url'),
                        courseId: parseInt(getCourseId(editor)),
                        objectVersion: searchParams.get('window_version')
                    }
                };
                let response = await addEduSharingInstance(ajaxParams);
                window.console.log(response);
                let isImage = domNode.nodeName.toLowerCase() === 'img';
                let previewUrl = `${Config.wwwroot}/lib/editor/atto/plugins/edusharing/preview.php`
                    + '?resourceId=' + response.id + '&' + searchParams.toString();
                domNode.setAttribute(isImage ? 'src' : 'href', previewUrl);
            }
        }
    };
    const container = window.document.createElement('div');
    container.innerHTML = editor.getContent();
    await iterateAsync(container);
    editor.setContent(container.innerHTML);
    for (const resourceId of initialElements) {
        let response = await deleteEduSharingInstance({
            eduDeleteStructure: {
                id: resourceId,
                courseId: parseInt(getCourseId(editor))
            }
        });
        window.console.log(response);
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
