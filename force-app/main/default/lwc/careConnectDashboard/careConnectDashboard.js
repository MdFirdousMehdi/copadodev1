import { LightningElement, track } from 'lwc';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import sendReminderApex from '@salesforce/apex/CareConnectController.sendReminder';
import getPatients from '@salesforce/apex/CareConnectController.getPatients';
import getAIInsights from '@salesforce/apex/CareConnectController.getAIInsights';

export default class CareConnectDashboard extends LightningElement {
    // UI State
    @track loadingPatients = false;
    @track loadingInsights = false;
    @track detailOpen = false;

    // Filters
    searchKey = '';
    riskFilter = '';
    riskOptions = [
        { label: 'All', value: '' },
        { label: 'Low', value: 'Low' },
        { label: 'Medium', value: 'Medium' },
        { label: 'High', value: 'High' },
    ];

    // Data from Apex
    patients = [];

    insights = [];

    metrics = { totalPatients: 0, totalPct: 0, activePlans: 0, activePlansPct: 0, overdue: 0, overduePct: 0, engagementRate: 0 };

    connectedCallback() {
        this.loadPatients();
    }

    async loadPatients() {
        this.loadingPatients = true;
        try {
            const data = await getPatients();
            this.patients = (data || []).map((p, idx) => ({
                id: p.patientId || p.patientid || p.patient_id || p.Id || 'row' + idx,
                name: p.name || p.Name,
                age: p.age,
                condition: p.condition,
                riskScore: p.riskScore || 0,
                lastVisit: p.lastVisitDate ? p.lastVisitDate : p.Last_Visit_Date__c,
                cssClass: this.computeCss(p)
            }));
            this.metrics.totalPatients = this.patients.length;
            this.metrics.totalPct = 100;
        } catch (e) {
            this.toast('Load Failed', e?.body?.message || e.message, 'error');
        } finally {
            this.loadingPatients = false;
        }
    }

    computeCss(p) {
        const score = p.riskScore || 0;
        const high = score > 80 || score >= 7; // support both 0-100 and 0-10 scales
        const last = p.lastVisitDate || p.Last_Visit_Date__c;
        let recent = false;
        try {
            if (last) {
                const dt = new Date(last);
                const diff = (Date.now() - dt.getTime()) / (1000*60*60*24);
                recent = diff <= 14;
            }
        } catch(e) {}
        return (recent ? 'recently-updated ' : '') + (high ? 'high-risk ' : '');
    }

    // Derived list for grid
    get filteredPatients() {
        const key = (this.searchKey || '').toLowerCase();
        const rf = (this.riskFilter || '').toLowerCase();
        return this.patients
            .map((p, idx) => {
                const riskLabel = this.scoreToLabel(p.riskScore);
                return {
                    key: idx,
                    id: p.id,
                    name: p.name,
                    age: p.age,
                    condition: p.condition,
                    lastVisitDisplay: p.lastVisit,
                    riskLabel,
                    riskClass: 'cc-badge ' + riskLabel.toLowerCase()
                };
            })
            .filter(p => !key || p.name.toLowerCase().includes(key) || p.id.toLowerCase().includes(key))
            .filter(p => !rf || p.riskLabel.toLowerCase() === rf);
    }

    scoreToLabel(score) {
        if (score >= 7) return 'High';
        if (score >= 4) return 'Medium';
        return 'Low';
    }

    // Event handlers
    handleSearch(e) {
        this.searchKey = e.target.value || '';
    }
    handleRiskChange(e) {
        this.riskFilter = e.detail.value;
    }

    handleCardClick(e) {
        const id = e.currentTarget?.dataset?.id;
        if (id) {
            this.openDetailById(id);
        }
    }

    openDetail(e) {
        const id = e.currentTarget?.dataset?.id;
        this.openDetailById(id);
    }

    selectedPatientId;
    selectedPatientName;
    async openDetailById(id) {
        const p = this.patients.find(x => x.id === id);
        this.selectedPatientId = null; // Using mock; set if using real Ids
        this.selectedPatientName = p ? p.name : '';
        this.detailOpen = true;
        // Fetch insights for selected patient
        await this.refreshInsights(id);
    }
    closeDetail() {
        this.detailOpen = false;
    }

    async sendReminder(e) {
        const patientId = e.currentTarget?.dataset?.id;
        const insIdx = this.insights.findIndex(i => i.patientId === patientId);
        if (insIdx >= 0) this.insights[insIdx].sending = true;
        try {
            await sendReminderApex({ patientId, channel: 'Email', message: 'Please schedule your follow-up visit.' });
            this.toast('Reminder Sent', 'Patient notified successfully', 'success');
        } catch (err) {
            this.toast('Send Failed', err?.body?.message || err.message, 'error');
        } finally {
            if (insIdx >= 0) this.insights[insIdx].sending = false;
            await this.refreshInsights(patientId);
        }
    }

    // Fetch insights list from Apex
    async refreshInsights(patientId) {
        if (!patientId) return;
        this.loadingInsights = true;
        try {
            const res = await getAIInsights({ patientId });
            this.insights = (res || []).map((line, idx) => ({
                id: 'ins' + idx,
                patientId,
                text: line,
                sending: false
            }));
        } catch (e) {
            this.toast('Insights Error', e?.body?.message || e.message, 'error');
        } finally {
            this.loadingInsights = false;
        }
    }

    toast(title, message, variant) {
        this.dispatchEvent(new ShowToastEvent({ title, message, variant }));
    }
}


