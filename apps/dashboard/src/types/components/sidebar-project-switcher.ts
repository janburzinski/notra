export interface SwitcherProject {
  id: string;
  name: string;
  brandSettingsId: string;
}

export interface ProjectSwitcherTriggerProps {
  project: SwitcherProject | undefined;
  domain: string | null;
  isLoading: boolean;
}

export interface ProjectMenuListProps {
  projects: SwitcherProject[];
  activeProjectId: string | undefined;
  projectDomain: (brandSettingsId: string) => string | null;
  onSwitch: (projectId: string) => void;
}
