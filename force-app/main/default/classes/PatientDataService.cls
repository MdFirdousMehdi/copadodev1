public with sharing class PatientDataService {
    public class PatientSummary {
        @AuraEnabled public Id patientId;
        @AuraEnabled public String name;
        @AuraEnabled public Integer age;
        @AuraEnabled public String gender;
        @AuraEnabled public String condition;
        @AuraEnabled public Date lastVisitDate;
        @AuraEnabled public Decimal riskScore;
        @AuraEnabled public String contactChannel;
    }

    @AuraEnabled(cacheable=true)
    public static List<PatientSummary> getPatients(Integer limitSize) {
        Integer fetchSize = (limitSize == null || limitSize <= 0) ? 50 : limitSize;
        // Enforce FLS safely: only select fields if readable
        Schema.SObjectType sType = Patient_Profile__c.SObjectType;
        Map<String, Schema.SObjectField> fieldMap = sType.getDescribe().fields.getMap();

        List<String> fieldApiNames = new List<String>();
        for (String name : new List<String>{
            'Name','Age__c','Gender__c','Condition__c','Last_Visit_Date__c','Risk_Score__c','Contact_Channel__c'
        }) {
            if (fieldMap.containsKey(name) && fieldMap.get(name).getDescribe().isAccessible()) {
                fieldApiNames.add(name);
            }
        }
        if (fieldApiNames.isEmpty()) {
            fieldApiNames.add('Name');
        }
        String soql = 'SELECT Id, ' + String.join(fieldApiNames, ',') +
            ' FROM Patient_Profile__c ORDER BY Last_Visit_Date__c DESC NULLS LAST LIMIT ' + String.valueOf(fetchSize);
        List<Patient_Profile__c> rows = Database.query(soql);
        List<PatientSummary> out = new List<PatientSummary>();
        for (Patient_Profile__c p : rows) {
            PatientSummary s = new PatientSummary();
            s.patientId = p.Id;
            s.name = p.Name;
            s.age = (Integer)p.get('Age__c');
            s.gender = (String)p.get('Gender__c');
            s.condition = (String)p.get('Condition__c');
            s.lastVisitDate = (Date)p.get('Last_Visit_Date__c');
            s.riskScore = (Decimal)p.get('Risk_Score__c');
            s.contactChannel = (String)p.get('Contact_Channel__c');
            out.add(s);
        }
        return out;
    }

    @AuraEnabled(cacheable=true)
    public static Patient_Profile__c getPatient(Id patientId) {
        if (patientId == null) {
            throw new AuraHandledException('patientId is required');
        }
        // Enforce FLS via Security.stripInaccessible
        List<Patient_Profile__c> recs = [
            SELECT Name, Age__c, Gender__c, Condition__c, Last_Visit_Date__c, Risk_Score__c, Contact_Channel__c, Consent__c
            FROM Patient_Profile__c WHERE Id = :patientId LIMIT 1
        ];
        List<Patient_Profile__c> safe = (List<Patient_Profile__c>) Security.stripInaccessible(AccessType.READABLE, recs).getRecords();
        return safe.isEmpty() ? null : safe[0];
    }

    @AuraEnabled(cacheable=true)
    public static List<Care_Activity__c> getCareActivities(Id patientId) {
        if (patientId == null) {
            throw new AuraHandledException('patientId is required');
        }
        List<Care_Activity__c> recs = [
            SELECT Name, Patient__c, Activity_Type__c, Due_Date__c, Status__c, Recommended_Action__c
            FROM Care_Activity__c WHERE Patient__c = :patientId ORDER BY Due_Date__c ASC NULLS LAST LIMIT 200
        ];
        List<Care_Activity__c> safe = (List<Care_Activity__c>) Security.stripInaccessible(AccessType.READABLE, recs).getRecords();
        return safe;
    }

    // Stub EHR callout via Named Credential or Static Resource fallback
    public static String fetchEhrData(Id patientId) {
        // If Named Credential exists, call it; else return mock static resource JSON
        try {
            Http http = new Http();
            HttpRequest req = new HttpRequest();
            req.setMethod('GET');
            // EHR_Endpoint is a Named Credential stub pointing to FHIR API
            req.setEndpoint('callout:EHR_Endpoint/patient/' + String.valueOf(patientId));
            HttpResponse res = http.send(req);
            if (res.getStatusCode() >= 200 && res.getStatusCode() < 300) {
                return res.getBody();
            }
        } catch (Exception e) {
            // Fall back to static resource
        }
        StaticResource sr = [SELECT Body FROM StaticResource WHERE Name = 'MockEhrPatient' LIMIT 1];
        return sr.Body.toString();
    }
}


