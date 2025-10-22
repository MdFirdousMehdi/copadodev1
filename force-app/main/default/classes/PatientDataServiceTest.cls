@IsTest
private class PatientDataServiceTest {
    @IsTest
    static void testGetPatientsAndDetails() {
        Patient_Profile__c p = new Patient_Profile__c(Name='Test Patient', Age__c=45, Gender__c='Male', Condition__c='Diabetes', Last_Visit_Date__c=Date.today().addDays(-200), Risk_Score__c=6.5, Contact_Channel__c='Email', Consent__c=true);
        insert p;
        Care_Activity__c a = new Care_Activity__c(Name='Checkup Reminder', Patient__c=p.Id, Activity_Type__c='Reminder', Due_Date__c=Date.today().addDays(7), Status__c='Planned', Recommended_Action__c='Schedule visit');
        insert a;

        Test.startTest();
        List<PatientDataService.PatientSummary> Patientlist = PatientDataService.getPatients(10);
        System.assert(Patientlist.size() > 0, 'Should return patients');
        Patient_Profile__c loaded = PatientDataService.getPatient(p.Id);
        System.assertEquals('Test Patient', loaded.Name);
        List<Care_Activity__c> acts = PatientDataService.getCareActivities(p.Id);
        System.assertEquals(1, acts.size());
        Test.stopTest();
    }
}


