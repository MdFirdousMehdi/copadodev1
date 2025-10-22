import { LightningElement, api, track } from 'lwc';
import loadPatient from '@salesforce/apex/CareConnectController.loadPatient';
import loadActivities from '@salesforce/apex/CareConnectController.loadActivities';
import getAiRecommendation from '@salesforce/apex/CareConnectController.getAiRecommendation';
import getAIInsights from '@salesforce/apex/CareConnectController.getAIInsights';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';

export default class CareConnectDetail extends LightningElement {
    @api patientId;
    @track patient;
    @track activities = [];
    @track ai;
    @track aiList = [];
    columns = [
        { label: 'Type', fieldName: 'Activity_Type__c' },
        { label: 'Due', fieldName: 'Due_Date__c', type: 'date' },
        { label: 'Status', fieldName: 'Status__c' },
        { label: 'Recommendation', fieldName: 'Recommended_Action__c' }
    ];

    connectedCallback() {
        if (this.patientId) {
            this.load();
        }
    }

    async load() {
        try {
            this.patient = await loadPatient({ patientId: this.patientId });
            this.activities = await loadActivities({ patientId: this.patientId });
            await this.refreshInsights();
        } catch (e) {
            this.toast('Error', e.body ? e.body.message : e.message, 'error');
        }
    }

    async getAi() {
        try {
            this.ai = await getAiRecommendation({ patientId: this.patientId });
            this.toast('AI Ready', 'Recommendation generated', 'success');
            await this.refreshInsights();
        } catch (e) {
            this.toast('AI Error', e.body ? e.body.message : e.message, 'error');
        }
    }

    async refreshInsights() {
        try {
            const list = await getAIInsights({ patientId: this.patientId });
            this.aiList = (list || []).map((line, idx) => ({ id: 'ai' + idx, text: line }));
        } catch (e) {
            // Best-effort; keep UI responsive
        }
    }

    toast(title, message, variant) {
        this.dispatchEvent(new ShowToastEvent({ title, message, variant }));
    }
}


