import { UUID, randomUUID } from "crypto";

const exampleUuid = randomUUID();

export namespace tsdConsts {
  export const importUrlRegEx = RegExp(
    /^https:\/\/data\.tsd\.usit\.no\/[0-9a-z]\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
  );
  export const importLink = (linkId: UUID): string =>
    `https://data.tsd.usit.no/c/${linkId}`;
  export const importLinkExample: string = importLink(exampleUuid);
  export const importLinkPlaceholder: string = importLink(
    "XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX"
  );
  export const getUuidFromImportUrl = (s: string): UUID | undefined =>
    s.split("/").pop() as UUID;
  export const tokenUrl = "https://data.tsd.usit.no/v1/all/auth/instances/token";
  export const uploadUrl = ({
    project,
    group,
    path,
  }: {
    project: string;
    group: string;
    path: string;
  }) =>
    `https://data.tsd.usit.no/v1/${project}/files/stream/${group}/${encodeURI(
      path
    )}`;
}
