import { LightningElement, wire, track } from 'lwc';
import getGroups from '@salesforce/apex/GroupController.getGroups';

export default class GroupManager extends LightningElement {
    @track groups;
    groupName = '';
    description = '';

    columns = [
        { label: 'Group Name', fieldName: 'Group_name__c' },
        { label: 'Description', fieldName: 'Description__c' },
        { label: 'Created By', fieldName: 'Created_By__c' }
    ];

    @wire(getGroups)
    wiredGroups({ data, error }) {
        if (data) {
            this.groups = data;
        } else if (error) {
            this.showToast('Error', error.body.message, 'error');
        }
    }

    handleInputChange(event) {
        const field = event.target.dataset.field;
        if (field === 'groupName') this.groupName = event.target.value;
        else if (field === 'description') this.description = event.target.value;
    }


}
