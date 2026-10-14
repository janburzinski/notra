const PLANS = [
  { name: "Free", monthly: 0, yearly: 0, note: "1,200 icons, MIT license" },
  { name: "Pro", monthly: 12, yearly: 96, note: "Every icon and illustration, Figma plugin" },
  { name: "Team", monthly: 39, yearly: 312, note: "Pro for up to 10 editors, shared libraries" },
];

export const PricingToggle = () => {
  const [yearly, setYearly] = useState(true);

  return (
    <div className="pm-widget pm-pricing not-prose">
      <div className="pm-switch" role="group" aria-label="Billing period">
        <button type="button" aria-pressed={!yearly} onClick={() => setYearly(false)}>Monthly</button>
        <button type="button" aria-pressed={yearly} onClick={() => setYearly(true)}>
          Yearly <span className="pm-save">save 33%</span>
        </button>
      </div>
      <div className="pm-plans">
        {PLANS.map((plan) => {
          const price = yearly ? plan.yearly / 12 : plan.monthly;
          return (
            <div key={plan.name} className="pm-plan" data-plan={plan.name.toLowerCase()}>
              <p className="pm-plan-name">{plan.name}</p>
              <p className="pm-price">
                <span data-testid={`price-${plan.name.toLowerCase()}`}>${price}</span>
                <small>/ month</small>
              </p>
              <p className="pm-billed">
                {plan.monthly === 0 ? "Free forever" : yearly ? `$${plan.yearly} billed yearly` : "Billed monthly"}
              </p>
              <p className="pm-note">{plan.note}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
};
