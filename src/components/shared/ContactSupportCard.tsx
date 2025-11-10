import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { LifeBuoy } from "lucide-react";

export function ContactSupportCard() {
  return (
    <Card className="bg-muted/50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <LifeBuoy className="h-5 w-5 text-primary" />
          <span>Support</span>
        </CardTitle>
        <CardDescription>Need help or have questions?</CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground mb-4">
          Our support team is here to help you with any issues you may be facing.
        </p>
        <Button asChild className="w-full" variant="secondary">
          <a href="mailto:support@campusexaminer.com">Contact Support</a>
        </Button>
      </CardContent>
    </Card>
  );
}
