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
 * edu-sharing Modal for Tiny.
 *
 * @module      tiny_edusharing/modal
 * @copyright   2022 metaVentis GmbH <http://metaventis.com>
 * @license     http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

import Modal from 'core/modal';
import ModalRegistry from 'core/modal_registry';

const EdusharingModal = class extends Modal {
    static TYPE = 'tiny_edusharing/modal';

    static TEMPLATE = 'tiny_edusharing/modal';

    registerEventListeners() {
        // Call the parent registration.
        super.registerEventListeners();

        // Register to close on save/cancel.
        this.registerCloseOnSave();
        this.registerCloseOnCancel();
    }
};

ModalRegistry.register(EdusharingModal.TYPE, EdusharingModal, EdusharingModal.TEMPLATE);

export default EdusharingModal;
