type Props = {
  sellerDescription: string;
  maintenanceHistory: string;
  accidentHistory: string;
  upgradeNotes: string;
  reasonForSelling: string;
  onChange: (
    field:
      | "sellerDescription"
      | "maintenanceHistory"
      | "accidentHistory"
      | "upgradeNotes"
      | "reasonForSelling",
    value: string
  ) => void;
};

function TextAreaField({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  return (
    <div>
      <label className="mb-2 block text-sm font-semibold text-cars-primary">{label}</label>
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="min-h-[120px] w-full rounded-[24px] border border-cars-gray-light px-4 py-3 text-sm text-cars-primary outline-none transition focus:border-cars-accent focus:ring-2 focus:ring-cars-accent/15"
        placeholder={placeholder}
      />
    </div>
  );
}

export default function SellerDescriptionForm({
  sellerDescription,
  maintenanceHistory,
  accidentHistory,
  upgradeNotes,
  reasonForSelling,
  onChange,
}: Props) {
  return (
    <section className="section-shell p-6">
      <p className="text-sm font-semibold uppercase tracking-[0.22em] text-cars-accent">Step 5</p>
      <h2 className="mt-2 text-3xl font-apercu-bold text-cars-primary">Description and seller notes</h2>
      <p className="mt-3 max-w-2xl text-sm leading-6 text-cars-gray">
        Strong descriptions reduce buyer hesitation. Mention service history, upgrades, and anything notable.
      </p>

      <div className="mt-6 grid gap-4">
        <TextAreaField
          label="Seller description"
          value={sellerDescription}
          onChange={(value) => onChange("sellerDescription", value)}
          placeholder="Describe the car's condition, standout features, and why buyers should pay attention."
        />
        <div className="grid gap-4 xl:grid-cols-2">
          <TextAreaField
            label="Maintenance history"
            value={maintenanceHistory}
            onChange={(value) => onChange("maintenanceHistory", value)}
            placeholder="Dealer serviced every 10,000 km, new tires in 2025..."
          />
          <TextAreaField
            label="Accident history"
            value={accidentHistory}
            onChange={(value) => onChange("accidentHistory", value)}
            placeholder="No accidents, or explain any known repairs transparently."
          />
          <TextAreaField
            label="Upgrades / accessories"
            value={upgradeNotes}
            onChange={(value) => onChange("upgradeNotes", value)}
            placeholder="Dashcam, ceramic coating, upgraded audio..."
          />
          <TextAreaField
            label="Reason for selling (optional)"
            value={reasonForSelling}
            onChange={(value) => onChange("reasonForSelling", value)}
            placeholder="Moving abroad, upgrading to an SUV, second car no longer needed..."
          />
        </div>
      </div>
    </section>
  );
}
