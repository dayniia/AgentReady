export type HttpMethod =
  | "GET"
  | "POST"
  | "PUT"
  | "PATCH"
  | "DELETE"
  | "HEAD"
  | "OPTIONS";

export type ParameterLocation = "path" | "query" | "body";

export type Parameter = {
  name: string;
  in: ParameterLocation;
  required: boolean;
};

export type SourceFile = {
  filePath: string;
  content: string;
};

export type Route = {
  filePath: string;
  method: HttpMethod;
  path: string;
  params: Parameter[];
  sourceHash: string;
};

export type ActionType =
  | "read"
  | "create"
  | "update"
  | "delete"
  | "search"
  | "other";

export type ClassificationStatus = "ok" | "unclassified";

export type ClassifiedRoute = Route & {
  action_name: string;
  description: string;
  action_type: ActionType;
  parameters: Parameter[];
  classification_status: ClassificationStatus;
};
