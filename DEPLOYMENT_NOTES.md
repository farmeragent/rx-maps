## Cloud run 

Deploy the agent on to Cloud Run using this command. Fill in the environment variables. 

```
gcloud run deploy farm-pulse-agent \
    --source . \
    --region us-central1 \
    --allow-unauthenticated \
    --set-env-vars="BQ_DATASET_ID=,GOOGLE_PROJECT_ID=,GOOGLE_API_KEY=" \
    --memory=1Gi \
    --cpu=1 \
    --timeout=300
```

