interface ZenodoDeposition {
  id: number;
  title: string;
  conceptrecid: string;
  state: string;
  submitted: boolean;
}

interface ZenodoMetadata {
  accessRight: string | null;
  version: string;
}
