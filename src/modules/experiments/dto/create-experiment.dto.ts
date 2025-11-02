//This file is a DTO (Data Transfer Object) for creating a new experiment.

//It is used to validate the data sent to the API when creating a new experiment.
//It is also used to define the shape of the data that is returned from the API when creating a new experiment.
//It is also used to define the shape of the data that is stored in the database when creating a new experiment.
//It is also used to define the shape of the data that is returned from the API when getting a new experiment.
//It is also used to define the shape of the data that is stored in the database when getting a new experiment.
//It is also used to define the shape of the data that is returned from the API when updating a new experiment.
//It is also used to define the shape of the data that is stored in the database when updating a new experiment.

export class CreateExperimentDto {
     name: string;
     date?: string;
     notes?: string;
     metricsSummary: {
       p50_ms?: number | null;
       p95_ms?: number | null;
       avg_ms?: number | null;
       requests_count?: number | null;
       rps?: number | null;
     };
     rawFile?: string;
   }
   