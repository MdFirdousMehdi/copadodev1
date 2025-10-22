import { LightningElement, track } from 'lwc';
import getAnalyticsData from '@salesforce/apex/CareConnectController.getAnalyticsData';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import { subscribe, onError, setDebugFlag } from 'lightning/empApi';

export default class CareConnectAnalytics extends LightningElement {
    @track loading = false;
    @track metrics = { totalPatients: 0, activeCarePlans: 0, highRiskCount: 0, engagementRate: 0 };
    @track riskDistribution = { Low: 0, Medium: 0, High: 0 };
    @track engagementByType = [];
    @track weeklyTrend = [];
    @track insightSummary = [];

    charts = {};
    _timer;

    connectedCallback() {
        this.handleRefresh();
        this._timer = window.setInterval(() => this.handleRefresh(), 30000);
        setDebugFlag(true);
        onError(() => {});
        this.subscribeToInsights();
    }
    disconnectedCallback() {
        if (this._timer) window.clearInterval(this._timer);
    }

    async handleRefresh() {
        this.loading = true;
        try {
            const data = await getAnalyticsData();
            this.animateMetrics({
                totalPatients: data.totalPatients || 0,
                activeCarePlans: data.activeCarePlans || 0,
                highRiskCount: data.highRiskCount || 0,
                engagementRate: data.engagementRate || 0
            });
            this.riskDistribution = data.riskDistribution || { Low: 0, Medium: 0, High: 0 };
            this.engagementByType = data.engagementByType || [];
            this.weeklyTrend = data.weeklyTrend || [];
            this.insightSummary = data.insightSummary || [];
            this.renderCharts();
        } catch (e) {
            this.toast('Analytics Error', e?.body?.message || e.message, 'error');
        } finally {
            this.loading = false;
        }
    }

    renderedCallback() {
        // Initialize charts once DOM is ready
        this.renderCharts();
    }

    renderCharts() {
        // Minimal inline charts using native canvas API for portability
        const riskCanvas = this.template.querySelector('canvas[data-chart="risk"]');
        const typeCanvas = this.template.querySelector('canvas[data-chart="type"]');
        const weeklyCanvas = this.template.querySelector('canvas[data-chart="weekly"]');
        if (riskCanvas) this.drawDonut(riskCanvas, [this.riskDistribution.Low, this.riskDistribution.Medium, this.riskDistribution.High], ['#2e7d32','#f9a825','#c62828']);
        if (typeCanvas) this.drawBars(typeCanvas, this.engagementByType.map(x=>x.label), this.engagementByType.map(x=>x.value));
        if (weeklyCanvas) this.drawLine(weeklyCanvas, this.weeklyTrend.map(x=>x.date), this.weeklyTrend.map(x=>x.value));
    }

    drawDonut(canvas, values, colors) {
        const ctx = canvas.getContext('2d');
        const total = values.reduce((a,b)=>a+b,0) || 1;
        let start = -Math.PI/2;
        const r = Math.min(canvas.width, canvas.height)/2 - 4;
        const cx = canvas.width/2, cy = canvas.height/2;
        ctx.clearRect(0,0,canvas.width,canvas.height);
        for (let i=0;i<values.length;i++) {
            const angle = (values[i]/total) * Math.PI*2;
            ctx.beginPath();
            ctx.moveTo(cx, cy);
            ctx.arc(cx, cy, r, start, start+angle);
            ctx.closePath();
            ctx.fillStyle = colors[i] || '#90a4ae';
            ctx.fill();
            start += angle;
        }
        ctx.globalCompositeOperation = 'destination-out';
        ctx.beginPath();
        ctx.arc(cx, cy, r*0.55, 0, Math.PI*2);
        ctx.fill();
        ctx.globalCompositeOperation = 'source-over';
    }

    drawBars(canvas, labels, values) {
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0,0,canvas.width,canvas.height);
        const w = canvas.width, h = canvas.height;
        const max = Math.max(...values, 1);
        const bw = Math.max(20, Math.floor((w - 40) / (values.length || 1)) - 10);
        let x = 20;
        values.forEach((v, i) => {
            const bh = Math.floor((v/max) * (h - 40));
            ctx.fillStyle = '#1976d2';
            ctx.fillRect(x, h - 20 - bh, bw, bh);
            x += bw + 10;
        });
    }

    drawLine(canvas, labels, values) {
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0,0,canvas.width,canvas.height);
        const w = canvas.width, h = canvas.height;
        const max = Math.max(...values, 1);
        const step = (w - 40) / ((values.length || 1) - 1 || 1);
        ctx.strokeStyle = '#26a69a';
        ctx.lineWidth = 2;
        ctx.beginPath();
        let x = 20;
        values.forEach((v, i) => {
            const y = h - 20 - Math.floor((v/max) * (h - 40));
            if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
            x += step;
        });
        ctx.stroke();
    }

    animateMetrics(target) {
        const duration = 450; // ms
        const frames = 18;
        const stepTime = Math.max(16, Math.floor(duration / frames));
        const start = { ...this.metrics };
        let frame = 0;
        const interval = window.setInterval(() => {
            frame++;
            const t = Math.min(1, frame / frames);
            this.metrics = {
                totalPatients: Math.round(start.totalPatients + (target.totalPatients - start.totalPatients) * t),
                activeCarePlans: Math.round(start.activeCarePlans + (target.activeCarePlans - start.activeCarePlans) * t),
                highRiskCount: Math.round(start.highRiskCount + (target.highRiskCount - start.highRiskCount) * t),
                engagementRate: Math.round(start.engagementRate + (target.engagementRate - start.engagementRate) * t)
            };
            if (t === 1) window.clearInterval(interval);
        }, stepTime);
    }

    subscribeToInsights() {
        const channel = '/event/Care_Insight_Event__e';
        subscribe(channel, -1, () => {
            this.handleRefresh();
        });
    }

    toast(title, message, variant) {
        this.dispatchEvent(new ShowToastEvent({ title, message, variant }));
    }
}


