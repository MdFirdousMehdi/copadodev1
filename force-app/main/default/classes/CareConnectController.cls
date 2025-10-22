public with sharing class CareConnectController {
    @AuraEnabled(cacheable=true)
    public static List<PatientDataService.PatientSummary> getPatients() {
        return PatientDataService.getPatients(50);
    }

    @AuraEnabled(cacheable=true)
    public static List<PatientDataService.PatientSummary> loadPatients(Integer limitSize) {
        return PatientDataService.getPatients(limitSize);
    }

    @AuraEnabled(cacheable=true)
    public static Patient_Profile__c loadPatient(Id patientId) {
        return PatientDataService.getPatient(patientId);
    }

    @AuraEnabled(cacheable=true)
    public static List<Care_Activity__c> loadActivities(Id patientId) {
        return PatientDataService.getCareActivities(patientId);
    }

    @AuraEnabled
    public static AIEngagementService.AIRecommendation getAiRecommendation(Id patientId) {
        return AIEngagementService.getRecommendation(patientId);
    }

    @AuraEnabled
    public static List<String> getAIInsights(Id patientId) {
        if (patientId == null) {
            throw new AuraHandledException('patientId is required');
        }
        AIEngagementService.AIRecommendation rec = AIEngagementService.getRecommendation(patientId);
        String ts = String.valueOf(Datetime.now());
        List<String> insights = new List<String>();
        insights.add(ts + ' | ' + rec.insightType + ' (' + rec.severity + '): ' + rec.recommendationText);
        return insights;
    }

    @AuraEnabled
    public static CareConnectAgent.AgentOutput analyzePatient(Id patientId) {
        return CareConnectAgent.analyze(patientId);
    }

    @AuraEnabled
    public static Care_Activity__c upsertCareActivity(Care_Activity__c activity) {
        if (activity == null) {
            throw new AuraHandledException('activity is required');
        }
        // Enforce CRUD/FLS
        SObjectAccessDecision decision = Security.stripInaccessible(AccessType.UPDATABLE, new List<SObject>{ activity });
        upsert decision.getRecords()[0];
        return activity;
    }

    @AuraEnabled
    public static void sendReminder(Id patientId, String channel, String message) {
        AIEngagementService.sendReminderAsync(patientId, channel, message);
    }

    @AuraEnabled(cacheable=true)
    public static Map<String, Object> getAnalyticsData() {
        Map<String, Object> result = new Map<String, Object>();

        Integer totalPatients = [SELECT COUNT() FROM Patient_Profile__c];
        Integer activePlans = [SELECT COUNT() FROM Care_Activity__c WHERE Status__c != 'Completed'];
        Integer overdue = [SELECT COUNT() FROM Care_Activity__c WHERE Status__c != 'Completed' AND Due_Date__c < :Date.today()];

       // Risk distribution (Low <4, Medium 4-6.9, High >=7)
        Integer highRiskCount = [SELECT COUNT() FROM Patient_Profile__c WHERE Risk_Score__c != null AND Risk_Score__c >= 7];
        Integer mediumRiskCount = [SELECT COUNT() FROM Patient_Profile__c WHERE Risk_Score__c >= 4 AND Risk_Score__c < 7];
        Integer lowRiskCount = [SELECT COUNT() FROM Patient_Profile__c WHERE Risk_Score__c != null AND Risk_Score__c < 4];

        Map<String, Integer> risk = new Map<String, Integer>{
            'Low' => lowRiskCount,
            'Medium' => mediumRiskCount,
            'High' => highRiskCount
        };

        // Engagement rate approximation: completed / total activities * 100
        Integer totalActs = [SELECT COUNT() FROM Care_Activity__c];
        Integer completedActs = [SELECT COUNT() FROM Care_Activity__c WHERE Status__c = 'Completed'];
        Integer engagementRate = totalActs > 0 ? Integer.valueOf(Math.floor((Decimal.valueOf(completedActs) / totalActs) * 100)) : 0;

        // Engagement per care category (Activity_Type__c)
        AggregateResult[] byType = [SELECT Activity_Type__c t, COUNT(Id) c FROM Care_Activity__c GROUP BY Activity_Type__c];
        List<Map<String, Object>> typeData = new List<Map<String, Object>>();
        for (AggregateResult ar2 : byType) {
            typeData.add(new Map<String, Object>{ 'label' => (String) ar2.get('t'), 'value' => (Integer) ar2.get('c') });
        }

        // Weekly trend (last 7 days by Due_Date__c)
        List<Map<String, Object>> weekly = new List<Map<String, Object>>();
        for (Integer i = 6; i >= 0; i--) {
            Date d = Date.today().addDays(-i);
            Integer cnt = [SELECT COUNT() FROM Care_Activity__c WHERE Due_Date__c = :d];
            weekly.add(new Map<String, Object>{ 'date' => String.valueOf(d), 'value' => cnt });
        }

        // Most frequent AI insight types (from activities recommended action keywords)
        // Placeholder: derive from latest 50 activities' Recommended_Action__c
        // Note: Cannot filter on Recommended_Action__c in SOQL; filter nulls in Apex instead
        List<Care_Activity__c> acts = [SELECT Recommended_Action__c FROM Care_Activity__c ORDER BY LastModifiedDate DESC LIMIT 50];
        Map<String, Integer> freq = new Map<String, Integer>();
        for (Care_Activity__c a : acts) {
            String key = 'Recommendation';
            if (a.Recommended_Action__c != null && a.Recommended_Action__c.length() > 0) {
                key = a.Recommended_Action__c.left(30);
            }
            freq.put(key, (freq.containsKey(key) ? freq.get(key) : 0) + 1);
        }
        List<Map<String, Object>> insightList = new List<Map<String, Object>>();
        for (String k : freq.keySet()) {
            insightList.add(new Map<String, Object>{ 'label' => k, 'value' => freq.get(k) });
        }

        result.put('totalPatients', totalPatients);
        result.put('activeCarePlans', activePlans);
        result.put('highRiskCount', risk.get('High'));
        result.put('engagementRate', engagementRate);
        result.put('riskDistribution', risk);
        result.put('engagementByType', typeData);
        result.put('weeklyTrend', weekly);
        result.put('insightSummary', insightList);
        return result;
    }
}


