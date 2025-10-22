# CareConnect (AI-driven healthcare engagement engine)

This repo includes a Proof of Concept called "CareConnect" that provides a Patient 360 view and AI-assisted patient engagement using Salesforce Health Cloud concepts, Apex, LWC, and external integrations.

## Features
- Patient 360 data via custom object `Patient_Profile__c`
- Care activities via `Care_Activity__c`
- AI recommendations via `AIEngagementService` and platform event `Care_Insight_Event__e`
- Unified decisioning agent `CareConnectAgent`
- LWCs: `careConnectDashboard` and `careConnectDetail`
- Named Credentials stubs for AI and EHR
- Mock EHR static resource for offline development

## Deploy to Scratch Org

1. Authenticate DevHub (one-time):
   ```powershell
   sf org login web --alias DevHub --set-default-dev-hub
   ```
2. Create scratch org:
   ```powershell
   sf org create scratch --definition-file config\project-scratch-def.json --alias CareConnect --duration-days 7 --set-default
   ```
3. Push metadata:
   ```powershell
   sf project deploy start --source-dir force-app
   ```
4. Open org:
   ```powershell
   sf org open
   ```

## Seed Sample Data (optional)
Use the UI to create a few `Patient_Profile__c` records and related `Care_Activity__c` rows. Ensure `Consent__c` is checked for testing reminders.

## Configure Named Credentials (optional)
This POC includes stub Named Credentials (`AI_Endpoint`, `EHR_Endpoint`). Update endpoints or auth as needed for real services.

## LWC Usage
- Add `careConnectDashboard` to a Lightning App/Home page for list + AI.
- Add `careConnectDetail` to a record page and supply `patientId` via page context.

## Architecture Summary
- Data model: `Patient_Profile__c`, `Care_Activity__c` (+ `Care_Insight_Event__e` platform event)
- Apex services:
  - `PatientDataService` (CRUD/FLS-safe reads, EHR callout fallback to static resource)
  - `AIEngagementService` (AI callout with fallback heuristics, publishes event, async reminder)
  - `CareConnectAgent` (unified recommendation output and suggested actions)
  - `CareConnectController` (LWC-facing APIs)
- Integrations:
  - Named Credentials: `AI_Endpoint`, `EHR_Endpoint`
  - Static resource: `MockEhrPatient`
- Security:
  - Enforces CRUD/FLS using `Security.stripInaccessible`
  - `Consent__c` flag required for outreach
