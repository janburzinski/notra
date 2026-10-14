export const IconName = ({ name }) => (
  <button type="button" className="pm-icon-name" data-copy={name} title={`Copy ${name}`}>
    {name}
  </button>
);
