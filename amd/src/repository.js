import {call as fetchMany} from 'core/ajax';

export const addEduSharingInstance = args => fetchMany([{
    methodname: 'mod_edusharing_add_instance',
    args: args
}])[0];

export const getTicket = args => fetchMany([{
    methodname: 'mod_edusharing_get_ticket',
    args: args
}])[0];

export const deleteEduSharingInstance = args => fetchMany([{
    methodname: 'mod_edusharing_delete_instance',
    args: args
}])[0];