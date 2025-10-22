public with sharing class CareConnectAgent {
    public class AgentInput {
        public PatientDataService.PatientSummary summary;
        public List<Care_Activity__c> activities;
        public String ehrJson;
    }

    public class AgentOutput {
        @AuraEnabled public String message;
        @AuraEnabled public String insightType;
        @AuraEnabled public String severity;
        @AuraEnabled public List<String> suggestedActions;
    }

    // Unified decision function used by controller and services
    public static AgentOutput analyze(Id patientId) {
        Patient_Profile__c p = PatientDataService.getPatient(patientId);
        if (p == null) throw new AuraHandledException('Patient not accessible');
        List<Care_Activity__c> acts = PatientDataService.getCareActivities(patientId);
        String ehrJson = PatientDataService.fetchEhrData(patientId);

        PatientDataService.PatientSummary s = new PatientDataService.PatientSummary();
        s.patientId = p.Id;
        s.name = p.Name;
        s.age = (Integer)p.get('Age__c');
        s.gender = (String)p.get('Gender__c');
        s.condition = (String)p.get('Condition__c');
        s.lastVisitDate = (Date)p.get('Last_Visit_Date__c');
        s.riskScore = (Decimal)p.get('Risk_Score__c');
        s.contactChannel = (String)p.get('Contact_Channel__c');

        AIEngagementService.AIRequest req = new AIEngagementService.AIRequest();
        req.patientId = patientId;
        req.name = s.name;
        req.condition = s.condition;
        req.lastVisitDate = s.lastVisitDate;
        req.riskScore = s.riskScore;
        req.activities = acts;

        AIEngagementService.AIRecommendation ai = (AIEngagementService.AIRecommendation) JSON.deserialize(JSON.serialize(AIEngagementService.getRecommendation(patientId)), AIEngagementService.AIRecommendation.class);

        AgentOutput out = new AgentOutput();
        out.message = ai.recommendationText;
        out.insightType = ai.insightType;
        out.severity = ai.severity;
        out.suggestedActions = buildActions(ai, s, acts);
        return out;
    }

    private static List<String> buildActions(AIEngagementService.AIRecommendation ai, PatientDataService.PatientSummary s, List<Care_Activity__c> acts) {
        List<String> actions = new List<String>();
        if (ai.insightType == 'Care Gap') {
            actions.add('Create checkup reminder');
            actions.add('Schedule appointment');
        } else if (ai.insightType == 'Risk Alert') {
            actions.add('Escalate to care team');
            actions.add('Arrange telehealth consult');
        } else {
            actions.add('Send educational content');
        }
        if (s.contactChannel != null) {
            actions.add('Send via ' + s.contactChannel);
        }
        return actions;
    }
}


