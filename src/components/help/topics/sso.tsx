import { Lead, H2, H3, P, UL, LI, Steps, Callout, DefList, Def, UI, Table } from "@/components/help/prose";

// Single sign-on and provisioning (docs/SSO.md). Written for any SAML 2.0 / SCIM 2.0
// identity provider. Provider guides go under "Provider guides": add a section per
// provider once it has been tested end to end, and keep the generic steps generic.

export default function Sso() {
  return (
    <>
      <Lead>
        Connect Tavoro to your company&rsquo;s identity provider (IdP) so people sign in with their work account, get added and removed
        automatically, and receive their Tavoro role from the groups they&rsquo;re in. Tavoro speaks the two open standards most identity
        providers support: <strong>SAML 2.0</strong> for sign-in and <strong>SCIM 2.0</strong> for provisioning.
      </Lead>

      <Callout tone="note">
        Admin-only. Everything here lives in <UI>Settings → Single sign-on</UI>. Each workspace has its own connection, so two workspaces can
        use different identity providers.
      </Callout>

      <H2>What each part does</H2>
      <DefList>
        <Def term="Single sign-on">
          People choose <UI>Sign in with SSO</UI> on the sign-in page (Tavoro sends them to the identity provider for their email&rsquo;s
          domain), or click Tavoro in their identity provider&rsquo;s app portal. Either way the provider vouches for them with a signed SAML
          response, and they land in the workspace.
        </Def>
        <Def term="Create on first sign-in">
          Optional. Anyone the identity provider lets into the app gets a Tavoro account the first time they sign in. With it off, only people
          already in the workspace (added by an admin or by provisioning) can sign in.
        </Def>
        <Def term="Provisioning (SCIM)">
          Optional. The identity provider creates members ahead of their first sign-in, keeps their name and email current, deactivates them
          when they leave, and sends their groups. A deactivated member is <strong>suspended</strong>: they can&rsquo;t sign in and their API
          tokens stop working, but everything they made stays, attributed to them.
        </Def>
        <Def term="Roles from groups">
          Optional. Map identity-provider groups to Tavoro roles (<UI>Admin</UI>, <UI>Manager</UI>, <UI>Member</UI>). A member gets the
          highest role any of their groups maps to, and the default role otherwise.
        </Def>
        <Def term="Require SSO">
          Optional. Members can no longer sign in with a password. Admins still can, so there&rsquo;s always a way in if the identity provider
          is down.
        </Def>
      </DefList>

      <H2>Set it up (any identity provider)</H2>
      <P>
        Keep two tabs open: Tavoro&rsquo;s <UI>Settings → Single sign-on</UI> and your identity provider&rsquo;s admin console. The settings
        page walks through the same five steps.
      </P>
      <Steps>
        <>
          <strong>Create the app in your identity provider.</strong> Add a custom <strong>SAML 2.0</strong> application and paste in the
          values from step 1 of Tavoro&rsquo;s settings page (see the table below for what your provider calls each one). Send the user&rsquo;s
          email address as the NameID, or in an attribute named <code>email</code>. Optionally also send <code>firstname</code> and{" "}
          <code>lastname</code> attributes, which Tavoro uses for the member&rsquo;s name.
        </>
        <>
          <strong>Give Tavoro the identity provider&rsquo;s details.</strong> Download the app&rsquo;s SAML metadata (XML) from your provider
          and paste it into step 2. If your provider doesn&rsquo;t offer metadata, choose <UI>Enter the values by hand instead</UI> and paste
          its entity ID, sign-in URL and signing certificate.
        </>
        <>
          <strong>Turn on sign-in.</strong> In step 3, tick <UI>Turn on single sign-on</UI>, list your <UI>Email domains</UI>, and save. Use{" "}
          <UI>Test sign-in in a new tab</UI> with an account your provider has assigned to the app.
        </>
        <>
          <strong>Optional: turn on provisioning.</strong> In step 4, choose <UI>Create token</UI> and copy the token (it&rsquo;s shown only
          once). In your provider, enable SCIM 2.0 provisioning for the app with Tavoro&rsquo;s <UI>SCIM base URL</UI> and the token.
        </>
        <>
          <strong>Optional: roles from groups.</strong> In step 5, tick <UI>Manage roles from groups</UI>, map group names to roles, pick the
          role for everyone else, and save. If you don&rsquo;t use provisioning, also have your provider send a groups attribute in the SAML
          response, named as in step 3&rsquo;s <UI>Group attribute name</UI> (default <code>memberOf</code>).
        </>
      </Steps>

      <H3>Values to give your identity provider</H3>
      <P>Identity providers name these fields differently. The values themselves are on Tavoro&rsquo;s settings page, with copy buttons.</P>
      <Table
        head={["Tavoro", "Also called", "What it is"]}
        rows={[
          [<UI key="a">ACS URL</UI>, "Assertion Consumer Service URL, Reply URL, Single sign-on URL", "Where the provider sends the signed response."],
          [<UI key="e">SP Entity ID</UI>, "Audience, Audience URI, Identifier, SP Issuer", "Tavoro's name for itself. Must match exactly."],
          [<UI key="l">Login URL</UI>, "Sign-on URL, Start URL", "Starts a sign-in from Tavoro's side (SP-initiated)."],
          [<UI key="m">SP metadata</UI>, "Service provider metadata", "All of the above in one XML file, for providers that can import it."],
          [<UI key="s">SCIM base URL</UI>, "Base URL, Tenant URL, SCIM connector base URL", "Where provisioning requests go. Enter it without a trailing slash."],
          [<UI key="t">SCIM token</UI>, "Token Key, Secret Token, API token, Bearer token", "Proves the requests come from your provider."],
        ]}
      />
      <P>From your identity provider, Tavoro needs:</P>
      <UL>
        <LI>
          <strong>Entity ID</strong> (Issuer), <strong>sign-in URL</strong> (SSO URL) and the <strong>signing certificate</strong>, all usually
          in its SAML metadata.
        </LI>
        <LI>
          <strong>A signed response or a signed assertion.</strong> Either is fine; Tavoro rejects responses with neither.
        </LI>
        <LI>
          <strong>The user&rsquo;s email</strong> as the NameID or in an <code>email</code> attribute.
        </LI>
      </UL>

      <H2>Provider guides</H2>
      <P>Step-by-step notes for providers Tavoro has been tested with. Other SAML 2.0 and SCIM 2.0 providers should work with the steps above.</P>

      <H3>JumpCloud</H3>
      <Steps>
        <>
          In the JumpCloud Admin Portal, open <UI>SSO Applications</UI>, choose <UI>Add New Application</UI>, search for and pick{" "}
          <UI>Custom Application</UI>, and select <strong>Manage Single Sign-On (SSO)</strong> with <strong>SAML 2.0</strong>. Tick{" "}
          <strong>Identity Management</strong> too if you want provisioning; JumpCloud attaches SCIM only to SAML apps.
        </>
        <>
          On the <UI>SSO</UI> tab: set <UI>IdP Entity ID</UI> to any unique name (for example <code>JumpCloud-Tavoro</code>), paste
          Tavoro&rsquo;s <UI>SP Entity ID</UI> and <UI>ACS URL</UI>, set <UI>SAMLSubject NameID</UI> to <strong>email</strong>, and paste
          Tavoro&rsquo;s <UI>Login URL</UI>. JumpCloud signs the response by default, which Tavoro accepts.
        </>
        <>
          Optionally, under <UI>User Attributes</UI>, send JumpCloud&rsquo;s <code>firstname</code> and <code>lastname</code> as{" "}
          <code>firstname</code> and <code>lastname</code> so members get their names. For roles from groups, tick{" "}
          <UI>Include Group Attribute</UI> and set <UI>Groups Attribute Name</UI> to <code>memberOf</code> (or whatever you entered in
          Tavoro). JumpCloud sends the groups that give the user access to the app.
        </>
        <>
          Save, then use <UI>Export Metadata</UI> and paste the XML into step 2 in Tavoro. Bind the user groups that should have Tavoro on the
          app&rsquo;s <UI>User Groups</UI> tab.
        </>
        <>
          For provisioning, open the <UI>Identity Management</UI> tab: <UI>API Type</UI> <strong>SCIM API</strong>, <UI>SCIM Version</UI>{" "}
          <strong>SCIM 2.0</strong>, <UI>Base URL</UI> = Tavoro&rsquo;s SCIM base URL, <UI>Token Key</UI> = Tavoro&rsquo;s SCIM token. For{" "}
          <UI>Test User Email</UI> use an address that isn&rsquo;t in Tavoro yet: JumpCloud creates and then deletes it as a test.
        </>
        <>
          Choose <UI>Test Connection</UI>, turn on group management (<strong>Enable management of User Groups and Group Membership</strong>) to
          send groups, then <UI>Activate</UI> and <UI>Save</UI>. Provisioning requests appear in Tavoro under{" "}
          <UI>Recent provisioning requests</UI>.
        </>
      </Steps>
      <Callout tone="tip">
        In JumpCloud, access is granted through user groups: people get Tavoro by being in a group bound to the app. Removing someone from
        every bound group deactivates them in Tavoro.
      </Callout>

      <H3>Adding another provider</H3>
      <P>
        Okta, Microsoft Entra ID and others follow the same pattern: a custom SAML 2.0 app with Tavoro&rsquo;s values, then SCIM 2.0
        provisioning to the SCIM base URL with the token. Check that your provider offers SCIM for <em>custom</em> apps; some only provision to
        apps in their own catalog. Tavoro&rsquo;s provisioning accepts the request styles the major providers use, and{" "}
        <UI>Recent provisioning requests</UI> shows exactly what yours sends.
      </P>

      <H2>How roles from groups work</H2>
      <UL>
        <LI>
          Group names match without regard to case. A member in several mapped groups gets the highest role: Admin, then Manager, then Member.
        </LI>
        <LI>
          Roles update when provisioning changes a group, and at each sign-in. Changing the mappings re-applies them to everyone linked to the
          identity provider at once.
        </LI>
        <LI>
          With provisioning on, it decides group membership. With it off, the group attribute in each sign-in does; a sign-in without the
          attribute means &ldquo;no groups&rdquo;, so a removed admin drops to the default role.
        </LI>
        <LI>
          A role changed by hand in <UI>Settings → Members</UI> lasts until the next update from the identity provider; the member list says
          when a role comes from groups.
        </LI>
        <LI>Tavoro never demotes or suspends the workspace&rsquo;s last active admin; that request is refused.</LI>
      </UL>

      <H2>Day to day</H2>
      <DefList>
        <Def term="Someone leaves">
          Deactivate or remove them in the identity provider. Tavoro suspends their membership: they&rsquo;re signed out of the workspace, their
          API tokens and connected apps stop working, and their cards, comments and reviews stay as they were. In{" "}
          <UI>Settings → Members</UI> they show as <UI>Suspended</UI>.
        </Def>
        <Def term="Someone comes back">
          Reactivate them in the identity provider, or choose <UI>Restore access</UI> on their row in Tavoro (the provider may suspend them
          again if it still has them deactivated).
        </Def>
        <Def term="The certificate is renewed">
          Paste the provider&rsquo;s new metadata into step 2. Tavoro shows when the current certificate expires and warns 30 days ahead. During
          a rollover you can paste both certificates; either one is accepted.
        </Def>
        <Def term="The identity provider is down">
          Admins can still sign in with their password, even when SSO is required. An admin can set a password for anyone from{" "}
          <UI>Settings → Members</UI>.
        </Def>
      </DefList>

      <H2>Troubleshooting</H2>
      <P>When a sign-in through the identity provider fails, the sign-in page says why:</P>
      <Table
        head={["Message", "What to check"]}
        rows={[
          [
            "…couldn't be verified",
            "The certificate, entity ID or SP Entity ID don't match, the response wasn't signed, or the clocks are more than a minute apart. Re-paste the provider's metadata and compare the SP Entity ID character for character.",
          ],
          ["…didn't send an email address", "Set the NameID to the user's email, or add an email attribute."],
          ["…don't have a Tavoro account in this workspace yet", "Create on first sign-in is off. Turn it on, add the person, or provision them."],
          ["…access to this workspace has been turned off", "The member is suspended. Reactivate them in the provider, or choose Restore access in Tavoro."],
          ["…isn't available for that workspace", "Single sign-on is switched off, or the identity provider's details are missing."],
        ]}
      />
      <UL>
        <LI>
          <strong>&ldquo;Single sign-on isn&rsquo;t set up for that email&rsquo;s domain&rdquo;</strong>: add the domain under{" "}
          <UI>Email domains</UI>. A domain can belong to one workspace&rsquo;s connection only.
        </LI>
        <LI>
          <strong>Provisioning fails</strong>: open <UI>Recent provisioning requests</UI>. A 401 means the token is wrong (make a new one and
          update the provider); other errors say which field or operation Tavoro couldn&rsquo;t accept. Check the base URL has no trailing
          slash.
        </LI>
        <LI>
          <strong>Roles don&rsquo;t change</strong>: the group name in Tavoro must match the provider&rsquo;s exactly (apart from case). The{" "}
          <UI>Groups Tavoro has received</UI> list shows the names that have arrived.
        </LI>
      </UL>
    </>
  );
}
