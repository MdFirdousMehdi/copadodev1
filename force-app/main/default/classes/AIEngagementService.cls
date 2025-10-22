public with sharing class AIEngagementService {
    public class AIRequest {
        public Id patientId;
        public String name;
        public String condition;
        public Date lastVisitDate;
        public Decimal riskScore;
        public List<Care_Activity__c> activities;
    }

    public class AIRecommendation {
        @AuraEnabled public String recommendationText;
        @AuraEnabled public String insightType; // Care Gap, Reminder, Risk Alert
        @AuraEnabled public String severity; // Low, Medium, High
    }

    @AuraEnabled
    public static AIRecommendation getRecommendation(Id patientId) {
        Patient_Profile__c p = PatientDataService.getPatient(patientId);
        if (p == null) {
            throw new AuraHandledException('Patient not found or inaccessible');
        }
        List<Care_Activity__c> acts = PatientDataService.getCareActivities(patientId);

        AIRequest req = new AIRequest();
        req.patientId = patientId;
        req.name = p.Name;
        req.condition = p.Condition__c;
        req.lastVisitDate = p.Last_Visit_Date__c;
        req.riskScore = p.Risk_Score__c;
        req.activities = acts;

        AIRecommendation rec = callAi(req);
        publishInsight(patientId, rec);
        return rec;
    }

    @Future(callout=true)
    public static void sendReminderAsync(Id patientId, String channel, String message) {
        // Placeholder: integrate with Messaging or external channel
        // Respect consent
        Patient_Profile__c p = PatientDataService.getPatient(patientId);
        if (p == null || p.Consent__c != true) return;
        try {
            Http h = new Http();
            HttpRequest r = new HttpRequest();
            r.setEndpoint('callout:AI_Endpoint/reminder');
            r.setMethod('POST');
            r.setHeader('Content-Type','application/json');
            r.setBody(JSON.serialize(new Map<String,Object>{
                'patientId' => String.valueOf(patientId),
                'channel' => channel,
                'message' => message
            }));
            h.send(r);
        } catch (Exception e) {
            System.debug('Reminder send failed: ' + e.getMessage());
        }
    }

    private static AIRecommendation callAi(AIRequest req) {
        try {
            Http h = new Http();
            HttpRequest r = new HttpRequest();
            r.setEndpoint('callout:AI_Endpoint/recommend');
            r.setMethod('POST');
            r.setHeader('Content-Type','application/json');
            r.setBody(JSON.serialize(req));
            HttpResponse resp = h.send(r);
            if (resp.getStatusCode() >= 200 && resp.getStatusCode() < 300) {
                Map<String,Object> m = (Map<String,Object>) JSON.deserializeUntyped(resp.getBody());
                AIRecommendation rec = new AIRecommendation();
                rec.recommendationText = (String) m.get('recommendationText');
                rec.insightType = (String) m.get('insightType');
                rec.severity = (String) m.get('severity');
                return rec;
            }
        } catch (Exception e) {
            // Fall back to rule-based heuristic
        }
        return fallbackRecommendation(req);
    }

    private static AIRecommendation fallbackRecommendation(AIRequest req) {
        AIRecommendation rec = new AIRecommendation();
        Date last = req.lastVisitDate;
        Boolean overdue = (last == null) || Date.today().daysBetween(last) > 180;
        if (req.riskScore != null && req.riskScore >= 7) {
            rec.insightType = 'Risk Alert';
            rec.severity = 'High';
            rec.recommendationText = 'High risk score. Schedule care team follow-up within 7 days.';
        } else if (overdue) {
            rec.insightType = 'Care Gap';
            rec.severity = 'Medium';
            rec.recommendationText = 'Patient is overdue for visit. Send reminder to book checkup.';
        } else {
            rec.insightType = 'Reminder';
            rec.severity = 'Low';
            rec.recommendationText = 'Maintain routine care. Share educational content on ' + (req.condition == null ? 'wellness' : req.condition) + '.';
        }
        return rec;
    }

    private static void publishInsight(Id patientId, AIRecommendation rec) {
        Care_Insight_Event__e evt = new Care_Insight_Event__e();
        evt.PatientId__c = String.valueOf(patientId);
        evt.InsightType__c = rec.insightType;
        evt.Severity__c = rec.severity;
        evt.Recommendation__c = rec.recommendationText;
        Database.SaveResult sr = EventBus.publish(evt);
        System.debug('Published Care_Insight_Event__e: ' + sr.isSuccess());
    }
}


