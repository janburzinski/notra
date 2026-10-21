import { DUB_CUSTOMER_EXTERNAL_ID_METADATA_KEY } from "@/constants/dub";
import { autumnAttachBodySchema } from "@/schemas/billing-checkout";

export async function withDubCheckoutMetadata(
  request: Request,
  resolveCustomerId: () => Promise<string | null>
): Promise<Request> {
  const { pathname } = new URL(request.url);
  const isAttach = pathname.endsWith("/attach");
  if (
    request.method !== "POST" ||
    !(isAttach || pathname.endsWith("/multiAttach"))
  ) {
    return request;
  }

  const customerId = await resolveCustomerId();
  if (!customerId) {
    return request;
  }

  const parsed = autumnAttachBodySchema.safeParse(
    await request
      .clone()
      .json()
      .catch(() => null)
  );
  if (!parsed.success) {
    return request;
  }

  const dubMetadata = { [DUB_CUSTOMER_EXTERNAL_ID_METADATA_KEY]: customerId };
  const body = isAttach
    ? {
        ...parsed.data,
        metadata: { ...parsed.data.metadata, ...dubMetadata },
      }
    : {
        ...parsed.data,
        checkoutSessionParams: {
          ...parsed.data.checkoutSessionParams,
          metadata: {
            ...parsed.data.checkoutSessionParams?.metadata,
            ...dubMetadata,
          },
        },
      };

  return new Request(request, {
    method: "POST",
    body: JSON.stringify(body),
  });
}
